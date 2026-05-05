# Saturn OSRM UI 
## Backend
- Saturn OSRM Backend

## Tools
### NodeJS
- node v22.22.0
- npm 10.9.4

### VSCodium

<pre>
codium --install-extension dbaeumer.vscode-eslint
codium --install-extension esbenp.prettier-vscode
codium --install-extension dsznajder.es7-react-js-snippets
codium --install-extension eamodio.gitlens
</pre>

### Preparation

```bash
node -v | sed 's/v//' > .nvmrc

npm install
```

### VTE proxy

```bash
export default defineConfig({
  // ... 
  server: {
    proxy: {
      '/api': {
        target: 'https://<host>',
        changeOrigin: true,
        secure: true,
      },
      '/api/socket': {
        target: 'wss://<host>>',
        ws: true,
        changeOrigin: true,
        secure: true,
      },
    },
  },
});

change <hosts> with current server
```

### Dev

```bash
  npm start
```

### Production Build & Deploy

```bash
  npm run build
```
