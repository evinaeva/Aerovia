export type AssetKind =
  | "apron"
  | "hangar"
  | "runway"
  | "plane"
  | "runwayConnector"
  | "hud"
  | "background"
  | "sky";

export type AssetPointKind =
  | "anchor"
  | "entrance"
  | "exit"
  | "insideStop"
  | "snap"
  | "landingEntry"
  | "touchdown"
  | "runwayStop"
  | "takeoffStart"
  | "liftOff"
  | "centerlineStart"
  | "centerlineEnd"
  | "apronConnection"
  | "runwayConnection"
  | "nose"
  | "tail"
  | "shadowOffset"
  | "hudTextSlot"
  | "hudIconSlot"
  | "pauseButton";

export type AssetRectKind =
  | "visualBounds"
  | "collisionBounds"
  | "hitArea"
  | "contentSafeArea"
  | "gameplayArea"
  | "textSlot"
  | "iconSlot"
  | "decorativeOnly";

export type AssetLayer =
  | "background"
  | "apron"
  | "structures"
  | "entities"
  | "routes"
  | "vfx"
  | "hud";

export interface AssetVec2 { x: number; y: number; }
export interface AssetSize { w: number; h: number; }
export interface AssetPoint { id: string; kind: AssetPointKind; x: number; y: number; radius?: number; label?: string; notes?: string; }
export interface AssetRect { id: string; kind: AssetRectKind; x: number; y: number; w: number; h: number; label?: string; notes?: string; }
export interface AssetMetadata {
  id: string; kind: AssetKind; src: string; logicalSize: AssetSize; anchor: AssetVec2; rects: AssetRect[]; points: AssetPoint[];
  allowedRotations?: number[]; defaultRotation?: number; rotationOffset?: number; layer?: AssetLayer; tags?: string[]; notes?: string;
}
export interface AssetMetadataFile { schemaVersion: 1; assets: AssetMetadata[]; }
