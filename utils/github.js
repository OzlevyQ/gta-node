export function remoteToHttps(remoteUrl) {
  if (!remoteUrl) return null;

  // SSH format: git@github.com:user/repo.git
  if (remoteUrl.startsWith('git@')) {
    return remoteUrl
      .replace('git@github.com:', 'https://github.com/')
      .replace(/\.git$/, '');
  }

  // HTTPS format: https://github.com/user/repo.git
  if (remoteUrl.startsWith('https://')) {
    return remoteUrl.replace(/\.git$/, '');
  }

  return remoteUrl;
}

export function extractRepoInfo(remoteUrl) {
  const httpsUrl = remoteToHttps(remoteUrl);
  if (!httpsUrl) return null;

  const match = httpsUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) return null;

  return {
    owner: match[1],
    repo: match[2],
  };
}
