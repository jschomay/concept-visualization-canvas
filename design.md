
# Concept Visualization Canvas

A web based application providing a fluid, organic and intuitive interface to facilitate rapid image generation exploration.

## Product design considerations

(As interpreted by me)

The key design principle behind this application is "frictionless exploration". This is exemplified in the following ways:

- Speed of generation
- Speed and automation of variation generation
- Simple and intuitive forking / culling
- Intuitive and organic organization

This principle should drive design and technical choices for each feature.


## Technical considerations

The desired tech stack is a python FastAPI server back end with a typescript React front end, leaning heavily on the HTML canvas element for the interactive portion of the UI.

Deployment can be fast and simple. Vercel is a good option for the front end code and fly.io or heroku is good for the server. Vercel's edge functions could potentially replace a full server, but a full server is preferred. Data should be stored in a persisted database. Postgres or even sqlite are valid options.

AI generation will be provided by OpenAI for prompt variation and fal.ai for fast image generation.

Both AI services require API keys which should be treated as secrets and therefore cannot be used directly in the client-side code. This requires some form of proxying to a server.

For OpenAI, the client can send requests to the server which can make authenticated requests to OpenAI and return the results to the client. These could be streamed, though the use case likely doesn't require that.

For Fal, latency should be as low as possible. Fal offers solutions to address this via their SDK and proxy server concept. Simply put, the proxy sever handles authentication that provides the client with a short-lived web token so that the client can interact over websockets directly with Fal's optimized inference servers. Using their SDK is recommended to handle the non-differentiating heavy lifting of token upkeep and streaming connection management. However, they only provide proxy server implementations for node.js based servers, while the desired back end stack is Python. One option is to implement the proxy server in Python, which should be straightforward. Another option is to use Vercel's edge functions for the proxy server to get that behavior for free, but route other persistence functionality through the main Python server, though that complicates authentication.

Authentication was not required in the project specs. However, given that the back end servers proxy AI services with real world costs, controlling access is prudent. Consider protecting server route access and implementing basic authentication at a minimum.


## Product management considerations

This project is well scoped with a limited set of required functionality. Nonetheless, it contains functionality across multiple domains with full stack architectural considerations. The project is expected to be delivered in whole, but a plan of approach is still relevant.

The high-level domains are:

- a highly interactive and performant interface
- integration with generative AI services
- persistence and session management

Development can be approached in vertical or horizontal feature sets. For example:

1: Horizontal slices: first develop the fully interactive canvas with proxies (for example, colored squares instead of images), then enhance the squares with AI generated content, then add persistence.

2: Vertical slices: user can generate a single image via AI which is persisted, then user can clone and change the image, then user can freely move any images and changes are persisted, etc.

While the horizontal approach may allow for more focused development in single areas of concern, the vertical approach is more agile and user-centric, making it possible to deliver incremental usable functionality, and opening up channels of faster and earlier user feedback, useful for making prioritization and scope decisions with higher confidence.

In the limited context of this project, the approach matters less, but in alignment with the guiding principle of enabling exploration with myself as the first user, work will be organized along the vertical approach. This also de-risks any deployment and integration obstacles by delivering a "steal thread" from the start.


##  Features

### Story 1: User can generate a single image

Navigating to the public url displays an empty page with a prompt input.
Entering a prompt generates an image.
Refreshing the page maintains the image and associated prompt.

Other considerations:
Include some form of authentication when entering the site.
CURL-ing any exposed server routes should return 403s.
Image generation should be nearly instantaneous.

### Story 2: TBD



## Further exploration

- Controlling image generation with ControlNet
- Real-time collaboration
- Separate canvases into multiple project pages
- Annotation and favoriting of images
- Full size image download
