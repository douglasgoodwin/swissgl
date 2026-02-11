# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SwissGL is a minimalistic wrapper on top of the WebGL2 JavaScript API (~950 lines). It reduces boilerplate for GPGPU-style procedural visualizations and simulations. The entire library is exposed through a single `glsl(params, target)` function. No build step, no dependencies.

**Origin**: Unofficial Google project by Alexander Mordvintsev. Apache 2.0 license.

## Running Locally

```
npm install
npm run dev
```

This starts a Vite dev server with hot reload. Open the displayed URL for the demo gallery, or navigate to `/tiny.html` for a minimal example.

There are no tests, no linter, and no CI configured.

## Architecture

### Core Library (`swissgl.js`)

Single file, no modules internally. Key components in order:

1. **Type/Format Tables** (top): Static mappings for WebGL uniform types, texture formats, and sampler states
2. **`TextureTarget`** class: Manages WebGL textures, framebuffers, and data readback (sync + async). Supports "story" arrays for ping-pong buffers (cyclic rotation for multi-frame simulations)
3. **`TextureSampler`** class: Memoized sampler objects for texture filtering/wrapping modes
4. **`MultisampleTarget`** class: MSAA render target support
5. **Shader compilation** (`compileShader`, `compileProgram`, `linkShader`): Compiles GLSL with built-in preamble of utility functions (hash, rotation matrices, geometry helpers)
6. **`drawQuads()`**: Core rendering orchestrator — sets up WebGL state, binds textures/uniforms, draws instanced tessellated planes
7. **`SwissGL(canvas)`**: Entry point that returns the `glsl()` function

### ES Module Wrapper (`swissgl.mjs`)

One-line re-export of `swissgl.js` for ESM imports.

### Demo System (`demo/`)

- `demo/main.js`: `DemoApp` class with demo switching, dat.gui integration, WebXR (VR/AR) support, and camera controls
- Each demo (e.g., `GameOfLife.js`, `ParticleLife3d.js`) exports a class with `frame(glsl)` method
- `index.html` loads all demos and the demo infrastructure

### Audio (`audio.js`)

`AudioStream` class using Web Audio API worklet for chunk-based audio streaming.

## Key Concepts for the `glsl()` API

- **`VP`/`FP`**: Vertex/fragment shader code snippets (expanded into full shaders automatically)
- **`Mesh: [w,h]`**: Tessellate the base plane; **`Grid: [w,h,d]`**: Instance the mesh
- **`tag`**: Cache key for compiled shader programs and texture buffers (`glsl.buffers`)
- **Blend**: String expressions like `'d*(1-sa)+s*sa'` or `'max(s,d)'`
- **Built-in GLSL variables**: `XY` ([-1,1]), `UV` ([0,1]), `ID` (instance), `Src` (previous frame texture)
- **Uniforms**: Automatically inferred from JS values passed in params object
