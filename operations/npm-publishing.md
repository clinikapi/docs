# Package Publishing & Distribution

ClinikAPI manages multiple high-fidelity packages within a monorepo. We use a hybrid approach: a **Private Monorepo** for core orchestration and a **Public Sync** for developer visibility and NPM distribution.

## 1. Distribution Strategy

Our packages are distributed across two channels:
*   **NPM Registry (@clinikehr/sdk, @clinikehr/react):** The primary consumption point for developers.
*   **Public GitHub (clinik-sdk-public):** A read-only mirror of the `packages/` directory for transparency and open-source contribution.

---

## 2. Automated Publishing Workflow

We utilize **GitHub Actions** and **Changesets** for precise versioning and publishing.

### The Trigger
When a PR is merged into `main`, the `Publish` workflow is triggered.

### Versioning with Changesets
Instead of manual version bumping, we use a changeset flow:
1.  **Create a Changeset:** Run `npx changeset` locally to document your change (patch/minor/major).
2.  **Commit:** A `.changeset/*.md` file is added to your PR.
3.  **Merge:** Upon merging to `main`, a "Version Packages" PR is automatically opened.
4.  **Release:** Merging the "Version Packages" PR triggers the NPM publish and GitHub Release.

---

## 3. Manual Publishing (Emergency Only)

If the CI/CD pipeline is blocked, packages can be published manually. 

> [!CAUTION]
> Manual publishing bypasses the automated version sync. Only use this for critical hotfixes authorized by the security team.

1.  **Authenticate:**
    ```bash
    npm login
    ```
2.  **Build:**
    ```bash
    turbo run build
    ```
3.  **Publish:**
    ```bash
    cd packages/[package-name]
    npm publish --access public
    ```

---

## 4. Public Repository Sync

To keep our public SDK repository in sync with the private monorepo, we use the `Sync Public Packages` workflow.

*   **Logic:** Every push to `main` that touches `packages/**` triggers a sync.
*   **Action:** The `cpina/github-action-push-to-another-repository` action mirrors the `packages/` folder to `Jethro-magaji/clinik-sdk-public`.
*   **Mirroring:** This ensures that while developers contribute to the public repo, the "source of truth" remains protected in the private infrastructure.

---

## 5. Security & Secrets

The following secrets must be maintained in the GitHub Repository:
*   `NPM_TOKEN`: A granular automation token for publishing to the `@clinikehr` scope.
*   `API_TOKEN_GITHUB`: A PAT with repo scope to allow syncing to the public mirror.
