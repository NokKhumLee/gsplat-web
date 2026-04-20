# /public/splats/

Place your `.splat`, `.ply`, or `.spz` Gaussian Splatting files here.

They will be served as static assets by Vite (dev) and Vercel (production).

## Reference in config.js

```js
{
  id: 'my-scene',
  label: 'My Scene',
  model: 'FM-LLPS',
  tag: 'EXP',
  url: '/splats/my-scene.splat',   // ← root-relative path to this directory
  thumbnail: null,
  metrics: { psnr: 28.5, ssim: 0.93, fmllps: 0.41 },
}
```

## Supported formats

| Format | Extension | Notes |
|--------|-----------|-------|
| Standard splat | `.splat` | antimatter15 format |
| PLY | `.ply` | INRIA original + SuperSplat/gsplat compressed |
| Niantic compressed | `.spz` | Smallest file size |
| KSplat | `.ksplat` | mkkellogg optimized format |
