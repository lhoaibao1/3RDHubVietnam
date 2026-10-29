// Kiểu cảnh 3D (không import three để store dùng được mà không kéo thư viện 3D vào gói chính).
export type SceneStyle = 'classic' | 'isometric' | 'factory' | 'ecosystem'
export const SCENE_IDS: SceneStyle[] = ['classic', 'isometric', 'factory', 'ecosystem']
export const isSceneStyle = (v: unknown): v is SceneStyle => SCENE_IDS.includes(v as SceneStyle)
