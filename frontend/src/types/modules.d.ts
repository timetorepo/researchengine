declare module 'mammoth/mammoth.browser' {
  export function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string; messages: any[] }>
  export function convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string; messages: any[] }>
}

// ReactBits components are vendored as plain JSX (JS-CSS variants, copied from
// DavidHDev/react-bits). The app has no allowJs, so they are typed loosely here.
declare module '@/components/reactbits/*' {
  const Component: any
  export default Component
  export const Card: any
}
