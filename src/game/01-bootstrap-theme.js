(() => {
  "use strict";
  const cv = document.getElementById('c');
  const ctx = cv.getContext('2d');

  // ---- облик: единый «neon» (тёмный ночной радар со свечением) ----
  // Облик один и зашит: неоновая палитра
  // (NEON_TOKENS ниже) поверх PALETTE + свечение в процедурной отрисовке, своя сцена
  // поля — drawNeonField. Спрайт-атлас (ниже) общий; neon-арт — в assets/sprites/neon/.

  // ---- палитра спрайтов: единый источник правды для перекраски ----
  // Спрайт-листы (assets/sprites/planeflow-*.svg) хранят цвета как
  // `var(--token, #fallbackhex)`, а не голым hex. Тема (THEME ниже) задаёт
  // значения токенов; их можно переопределять «сколько угодно» на лету.
  // Дефолтная тема пустая → срабатывает fallback-hex в самих SVG → вид 1-в-1
  // как раньше. Передай объект-переопределение в blitC/blit, чтобы перекрасить
  // отдельный спрайт под любую палитру; ключ кэша учитывает тему, поэтому разные
  // перекраски сосуществуют без коллизий.
  const PALETTE = {
    // базовые токены повторяют :root
    ink:'#16131f', tarmac:'#242842', water:'#1c3a42',
    paper:'#f4eede', amber:'#f2a93b', teal:'#4ecdc4', ice:'#7fd6ff',
    rose:'#ef798a', gold:'#f4cf5e', life:'#ef5365', phosphor:'#cdb0f7',
    // расширенные токены спрайтов (см. assets/sprites/README.md — карта токенов)
    'cream-100':'#f4eede', 'cream-200':'#e8e0cf', 'cream-outline':'#b9b0a0',
    'gold-dim':'#caa53a', 'gold-ink':'#5e4a16', 'amber-glow':'#ffb84d',
    'amber-core':'#ffd089', green:'#5dca7a', 'green-bright':'#7fe098',
    red:'#e0584f', blue:'#4ab4d6', chip:'#2a2440', 'navy-900':'#1a1d2e',
    'purple-700':'#3a3354', 'purple-600':'#46406a', 'bay-dim':'#1f1b2c',
    'gray-500':'#8a8c99', 'gray-600':'#6b6d7a', white:'#ffffff',
    grass:'#38482f', 'grass-dim':'#2e3b27', 'grass-tuft':'#46583b',
    'water-wave':'#2a525c', 'water-wave2':'#3a6b76', sand:'#6b5c44',
    wood:'#4a3f33', shadow:'#0a0614', 'sky-low':'#3a2f3e', 'sky-mid':'#241d33',
  };
  // Неоновая палитра: тёмная база + яркие насыщенные акценты со свечением.
  // Применяется как переопределение токенов поверх PALETTE — перекрашивает и
  // процедурную отрисовку (COL уважает THEME.tokens), и подписи/иконки.
  const NEON_TOKENS = {
    ink:'#070c1c', tarmac:'#0c1430', 'tarmac-2':'#0f1a3c', water:'#081024',
    phosphor:'#3ad2ff', 'cream-100':'#dff4ff', muted:'#5f7bb0',
    amber:'#ffb13b', teal:'#22e3c6', ice:'#5fd2ff', rose:'#ff4f9d',
    gold:'#ffd23b', life:'#ff3b6b',
    // neon-геймплей (handoff): праймари-зелёный (купленный апгрейд), сирень (цель/VIP),
    // тёмно-синий «сердечник» апрона — см. docs/design/skins/neon/handoff/
    green:'#5de08a', 'green-bright':'#7df0a4', purple:'#b98cff', core:'#16245e',
  };
  // Активная тема: неоновые переопределения PALETTE. SPRITES/COL читают THEME.tokens,
  // поэтому перекраска одинаково ложится и на спрайты, и на процедурную отрисовку.
  const THEME = { tokens: NEON_TOKENS };

  // ---- спрайт-атлас (canvas) ----
  // Базовые листы (assets/sprites/planeflow-*.svg) и neon-арт (assets/sprites/neon/)
  // грузятся один раз в скрытый holder; каждый <symbol> растеризуется в <img> под
  // device-pixel размер, кэшируется и блитится по кадру. Пока спрайт не готов (или
  // ATLAS=false) вызов возвращает false и call-site падает на процедурную отрисовку —
  // игра никогда не рисует пусто.
  //
  // Перекраска: SVG используют `var(--token, #hex)`. Чтобы перекрасить, передай
  // в blitC/blit объект-переопределение токенов (напр. {gold:'#fff', amber:'#0f0'})
  // — он впрыснется в спрайт как <style>:root{--token:value}. Строка в `color`
  // по-прежнему задаёт `currentColor` (используется только для route-arrow).
  // ATLAS=true, когда neon-арт загружен; иначе процедурный фолбэк (неоновая палитра
  // подхватывается через THEME.tokens).
  let ATLAS = false;
