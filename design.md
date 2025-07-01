
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

The initial desired tech stack was a deployed python FastAPI server back end with a typescript React front end, leaning heavily on the HTML canvas element for the interactive portion of the UI. However, upon exploration, Fal.id provides a helpful SDK that primarily supports javascript server side frameworks like next.js. Next.js works well with Vercel, which supports both front end code deployment and next.js edge functions. While less robust than a dedicated server, these should suffice for the server side requirements for Fal.ai authentication and the other minimal server functionality. Vercel also integrates seamlessly with data storage providers like Supabase, making a separate back end server less necessary for the scope of this project. In the interest of simplifying deployment infrastructure and streamlining development, the chosen technical stack is fully TypeScript using hosting services like Vercel and Supabase.

AI generation will be provided by OpenAI for prompt variation and fal.ai for fast image generation.

Both AI services require API keys which should be treated as secrets and therefore cannot be used directly in the client-side code. This requires some form of proxying to a server.

For OpenAI, the client can send requests to the server which can make authenticated requests to OpenAI and return the results to the client. These could be streamed, though the use case likely doesn't require that. Given the tech stack decision, these requests still likely go through Vercel edge functions, or Vercel's AI package.

For Fal, latency should be as low as possible. Fal offers solutions to address this via their SDK and proxy server concept. Simply put, the proxy sever handles authentication that provides the client with a short-lived web token so that the client can interact over websockets directly with Fal's optimized inference servers. Using their SDK is recommended to handle the non-differentiating heavy lifting of token upkeep and streaming connection management. As discussed, for the sake of expediency, their out of the box next.js approach will be used instead of implementing and hosting a proxy server in Python.

Authentication was not required in the project specs. However, given that the back end servers proxy AI services with real world costs, controlling access is prudent. Consider protecting server route access and implementing basic authentication at a minimum. Vercel may cover this automatically. Furthermore, Supabase offers simple user authentication if desired.


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
Include some form of authentication when entering the site. (deferred)
CURL-ing any exposed server routes should return 403s. (deferred)
Image generation should be nearly instantaneous.
Handle the initial empty state.


### Story 2: User sees generated images as they type

Editing the text prompt updates the generated image while typing.

Consider:
Debouncing
Race conditions



## Further exploration

- Controlling image generation with ControlNet
- Real-time collaboration
- Separate canvases into multiple project pages
- Annotation and favoriting of images
- Full size image download
