const repoName = process.env.GITHUB_REPOSITORY?.split('/')?.[1]?.trim() || '';
const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || '';
const basePath = configuredBasePath || (process.env.GITHUB_ACTIONS === 'true' && repoName ? `/${repoName}` : '');

const nextConfig = {
  output: 'export',
  trailingSlash: true,
  reactStrictMode: true,
  ...(basePath ? { basePath } : {}),
  images: {
    unoptimized: true
  }
};

export default nextConfig;
