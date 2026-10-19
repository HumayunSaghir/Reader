import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173
  },
  build: {
    target: 'es2022',
    rolldownOptions: {
      output: {
        // Stable vendor chunks change rarely, so browsers keep them cached
        // across app deploys; markdown is only needed on a few pages.
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/, priority: 20 },
            { name: 'markdown', test: /node_modules[\\/](react-markdown|remark-|rehype-|micromark|mdast-|hast-|unist-|unified|vfile|property-information|space-separated-tokens|comma-separated-tokens|decode-named-character-reference|character-entities|html-url-attributes|devlop|bail|trough|zwitch|ccount|estree-util|style-to|inline-style-parser|trim-lines|longest-streak|markdown-table|is-plain-obj)/, priority: 15 },
            { name: 'vendor', test: /node_modules/, priority: 10 }
          ]
        }
      }
    }
  }
})
