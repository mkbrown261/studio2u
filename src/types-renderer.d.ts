import type {} from 'hono'

declare module 'hono' {
  interface ContextRenderer {
    (content: string | Promise<string> | JSX.Element, props?: { title?: string; description?: string; jsonLd?: string }): Response | Promise<Response>
  }
}
