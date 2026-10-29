// Kiểu cảnh 3D (không import three để store dùng được mà không kéo thư viện 3D vào gói chính).
export type SceneStyle = 'classic' | 'isometric' | 'factory' | 'ecosystem' | 'orbit' | 'voxel' | 'blueprint' | 'neon'
export const SCENE_IDS: SceneStyle[] = ['classic', 'isometric', 'factory', 'ecosystem', 'orbit', 'voxel', 'blueprint', 'neon']
export const isSceneStyle = (v: unknown): v is SceneStyle => SCENE_IDS.includes(v as SceneStyle)
/** Kiểu sáng (cảnh ban ngày) để trang đổi màu nền cho hợp. */
export const DAY_STYLES: SceneStyle[] = ['voxel']
