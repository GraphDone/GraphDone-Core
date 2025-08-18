// vite.config.ts
import { defineConfig } from "file:///home/mvalancy/Code/GraphDone-Core/node_modules/vite/dist/node/index.js";
import react from "file:///home/mvalancy/Code/GraphDone-Core/node_modules/@vitejs/plugin-react/dist/index.js";
import { resolve } from "path";
import { hostname } from "os";
var __vite_injected_original_dirname = "/home/mvalancy/Code/GraphDone-Core/packages/web";
var vite_config_default = defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__vite_injected_original_dirname, "./src"),
      "@graphdone/core": resolve(__vite_injected_original_dirname, "../core/src")
    }
  },
  server: {
    host: "0.0.0.0",
    // Listen on all interfaces for external access
    port: Number(process.env.PORT) || 3127,
    strictPort: true,
    // Exit if port is already in use instead of trying next available
    allowedHosts: ["localhost", hostname(), "*.local", ".tailscale"],
    // Auto-detect hostname + common patterns
    proxy: {
      "/graphql": {
        target: "http://localhost:4127",
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: "dist",
    sourcemap: true
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/test/",
        "**/*.config.ts"
      ]
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9tdmFsYW5jeS9Db2RlL0dyYXBoRG9uZS1Db3JlL3BhY2thZ2VzL3dlYlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2hvbWUvbXZhbGFuY3kvQ29kZS9HcmFwaERvbmUtQ29yZS9wYWNrYWdlcy93ZWIvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2hvbWUvbXZhbGFuY3kvQ29kZS9HcmFwaERvbmUtQ29yZS9wYWNrYWdlcy93ZWIvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgeyByZXNvbHZlIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBob3N0bmFtZSB9IGZyb20gJ29zJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3JlYWN0KCldLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgICdAJzogcmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYycpLFxuICAgICAgJ0BncmFwaGRvbmUvY29yZSc6IHJlc29sdmUoX19kaXJuYW1lLCAnLi4vY29yZS9zcmMnKVxuICAgIH1cbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgaG9zdDogJzAuMC4wLjAnLCAvLyBMaXN0ZW4gb24gYWxsIGludGVyZmFjZXMgZm9yIGV4dGVybmFsIGFjY2Vzc1xuICAgIHBvcnQ6IE51bWJlcihwcm9jZXNzLmVudi5QT1JUKSB8fCAzMTI3LFxuICAgIHN0cmljdFBvcnQ6IHRydWUsIC8vIEV4aXQgaWYgcG9ydCBpcyBhbHJlYWR5IGluIHVzZSBpbnN0ZWFkIG9mIHRyeWluZyBuZXh0IGF2YWlsYWJsZVxuICAgIGFsbG93ZWRIb3N0czogWydsb2NhbGhvc3QnLCBob3N0bmFtZSgpLCAnKi5sb2NhbCcsICcudGFpbHNjYWxlJ10sIC8vIEF1dG8tZGV0ZWN0IGhvc3RuYW1lICsgY29tbW9uIHBhdHRlcm5zXG4gICAgcHJveHk6IHtcbiAgICAgICcvZ3JhcGhxbCc6IHtcbiAgICAgICAgdGFyZ2V0OiAnaHR0cDovL2xvY2FsaG9zdDo0MTI3JyxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlXG4gICAgICB9XG4gICAgfVxuICB9LFxuICBidWlsZDoge1xuICAgIG91dERpcjogJ2Rpc3QnLFxuICAgIHNvdXJjZW1hcDogdHJ1ZVxuICB9LFxuICB0ZXN0OiB7XG4gICAgZ2xvYmFsczogdHJ1ZSxcbiAgICBlbnZpcm9ubWVudDogJ2pzZG9tJyxcbiAgICBzZXR1cEZpbGVzOiBbJy4vc3JjL3Rlc3Qvc2V0dXAudHMnXSxcbiAgICBjb3ZlcmFnZToge1xuICAgICAgcHJvdmlkZXI6ICd2OCcsXG4gICAgICByZXBvcnRlcjogWyd0ZXh0JywgJ2pzb24nLCAnaHRtbCddLFxuICAgICAgZXhjbHVkZTogW1xuICAgICAgICAnbm9kZV9tb2R1bGVzLycsXG4gICAgICAgICdzcmMvdGVzdC8nLFxuICAgICAgICAnKiovKi5jb25maWcudHMnXG4gICAgICBdXG4gICAgfVxuICB9XG59KTsiXSwKICAibWFwcGluZ3MiOiAiO0FBQStULFNBQVMsb0JBQW9CO0FBQzVWLE9BQU8sV0FBVztBQUNsQixTQUFTLGVBQWU7QUFDeEIsU0FBUyxnQkFBZ0I7QUFIekIsSUFBTSxtQ0FBbUM7QUFLekMsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLEVBQ2pCLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsTUFDL0IsbUJBQW1CLFFBQVEsa0NBQVcsYUFBYTtBQUFBLElBQ3JEO0FBQUEsRUFDRjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBO0FBQUEsSUFDTixNQUFNLE9BQU8sUUFBUSxJQUFJLElBQUksS0FBSztBQUFBLElBQ2xDLFlBQVk7QUFBQTtBQUFBLElBQ1osY0FBYyxDQUFDLGFBQWEsU0FBUyxHQUFHLFdBQVcsWUFBWTtBQUFBO0FBQUEsSUFDL0QsT0FBTztBQUFBLE1BQ0wsWUFBWTtBQUFBLFFBQ1YsUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLE1BQ2hCO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLFdBQVc7QUFBQSxFQUNiO0FBQUEsRUFDQSxNQUFNO0FBQUEsSUFDSixTQUFTO0FBQUEsSUFDVCxhQUFhO0FBQUEsSUFDYixZQUFZLENBQUMscUJBQXFCO0FBQUEsSUFDbEMsVUFBVTtBQUFBLE1BQ1IsVUFBVTtBQUFBLE1BQ1YsVUFBVSxDQUFDLFFBQVEsUUFBUSxNQUFNO0FBQUEsTUFDakMsU0FBUztBQUFBLFFBQ1A7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
