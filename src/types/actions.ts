export type Action =
  | { type: 'key'; key: string }
  | { type: 'key_combination'; keys: string[] }
  | { type: 'type'; text: string }
  | { type: 'click'; button: 'left' | 'right'; x: number; y: number }
  | { type: 'wait'; ms: number };