### Runtime image
This actor uses **Playwright**. On Apify you must use a Playwright-enabled base image.

- actor.json: `"baseDockerImage": "apify/actor-node-playwright-chrome:latest"`

> Do **not** add `playwright` to package.json when using the Apify Playwright base image; it's preinstalled.
