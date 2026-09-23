export interface ThemeProject {
  readonly author: string;
  readonly license: string;
  readonly licenseUrl: string;
  readonly name: string;
  readonly repositoryUrl: string;
}

export type ThemeProjectOptions = Readonly<Partial<ThemeProject>>;

const defaultProject: ThemeProject = {
  author: "VdustR",
  license: "MIT License",
  licenseUrl: "https://github.com/vp-tw/dirwell/blob/main/LICENSE",
  name: "Dirwell",
  repositoryUrl: "https://github.com/vp-tw/dirwell",
};

export function resolveThemeProject(options?: ThemeProjectOptions): ThemeProject {
  return {
    author: options?.author ?? defaultProject.author,
    license: options?.license ?? defaultProject.license,
    licenseUrl: options?.licenseUrl ?? defaultProject.licenseUrl,
    name: options?.name ?? defaultProject.name,
    repositoryUrl: options?.repositoryUrl ?? defaultProject.repositoryUrl,
  };
}
