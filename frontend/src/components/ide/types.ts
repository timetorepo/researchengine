export interface ProjectInfo { name: string; files: number; size: number; mtime: number; git: boolean }
export interface TreeNode { name: string; path: string; dir: boolean; children?: TreeNode[] }
export interface OpenFile { path: string; content: string; disk: string }
