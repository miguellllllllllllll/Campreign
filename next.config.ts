import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  turbopack: {
    /*
     * Pin the workspace root to this project.
     *
     * Turbopack finds the root by walking up for a lockfile, and there is a
     * second package-lock.json in the home directory above this one. Left to
     * infer, it picks that one and warns on every boot. Stating the root here
     * fixes it inside the repo rather than by deleting a file that belongs to
     * somebody else's project.
     */
    root: __dirname,
  },
}

export default nextConfig
