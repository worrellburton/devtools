export const SETUP_PROMPT_TEMPLATE = `Connect to my GitHub repo and set up the codebase. Make sure it's connected to (branch) successfully and we are accessing the site that the build/deploy published correctly. Changes being made now on will be on most up to date site.
Send me the live URL (e.g., GitHub Pages link or deploy preview) once you've confirmed it's up.

Once done say 'We got greensmoke'`;

export const ENABLE_ACTIONS_TEMPLATE = `Add a GitHub Actions workflow to my repo (repo). The workflow should:
1. Deploy to GitHub Pages on push to (branch)
2. Keep all existing code, files, and configuration intact — do NOT remove or overwrite anything
3. Use the standard GitHub Pages deploy action (actions/deploy-pages)
4. Enable GitHub Pages in the repo settings if not already enabled (source: GitHub Actions)
5. Make sure the workflow file is at .github/workflows/deploy.yml

After adding the workflow, push to (branch) and confirm the action runs successfully.
Send me the live GitHub Pages URL once deployed.

Once done say 'We got greensmoke'`;
