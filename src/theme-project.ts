export interface ThemeProject {
  readonly author: string;
  readonly authorUrl?: string;
  readonly license: string;
  readonly licenseUrl: string;
  readonly name: string;
  readonly repositoryUrl: string;
}

export type ThemeProjectOptions = Readonly<Partial<ThemeProject>>;

const defaultProject: ThemeProject = {
  author: "VdustR",
  authorUrl: "https://github.com/VdustR",
  license: "MIT License",
  licenseUrl: "https://github.com/VdustR/dirwell/blob/main/LICENSE",
  name: "Dirwell",
  repositoryUrl: "https://github.com/VdustR/dirwell",
};

export function resolveThemeProject(options?: ThemeProjectOptions): ThemeProject {
  const author = options?.author ?? defaultProject.author;
  return {
    author,
    ...(options?.authorUrl !== undefined
      ? { authorUrl: options.authorUrl }
      : author === defaultProject.author
        ? { authorUrl: defaultProject.authorUrl }
        : {}),
    license: options?.license ?? defaultProject.license,
    licenseUrl: options?.licenseUrl ?? defaultProject.licenseUrl,
    name: options?.name ?? defaultProject.name,
    repositoryUrl: options?.repositoryUrl ?? defaultProject.repositoryUrl,
  };
}
