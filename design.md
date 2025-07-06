
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

### Stack

The initial desired tech stack was a deployed python FastAPI server back end with a typescript React front end. However, upon exploration, Fal.ai provides a helpful SDK that works out of the box with javascript server side frameworks like next.js. Next.js works well with Vercel, which supports both front end code deployment, and next.js edge functions for serverless needs.

While less robust than a dedicated server, edge functions should suffice for the needs of this project. Vercel also integrates seamlessly with data storage providers like Supabase, making a separate back end server less necessary for the scope of this project. In the interest of simplifying deployment infrastructure and streamlining development, the chosen technical stack is fully TypeScript using hosting services like Vercel and Supabase.

### UI

Originally, HTML Canvas was desired for the heavy UI interactions, especially considering likely feature requests like a pan-able, zoom-able canvas. However, this this has down sides too and proves technically challenging unless using a dedicated canvas UI library. In the interest of expediency and the scope of this project, standard React elements with absolute CSS position will be used instead.

### Authentication

AI generation will be provided by OpenAI for prompt variation and fal.ai for fast image generation.

Both AI services require API keys which should be treated as secrets and therefore cannot be used directly in the client-side code. This requires some form of proxying to a server.

For OpenAI, the client can send requests to the server which can make authenticated requests to OpenAI and return the results to the client. These could be streamed, though the use case likely doesn't require that. Given the tech stack decision, these requests would go through Vercel as edge functions, and can lean on Vercel's AI SDK for streamlined simplicity.

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

### Story 3: User can clone images

Hovering over a generated image reveals a "clone" button.
When clicked, a copy of the image appears to the right.
Either image can be selected, indicated visually and by the input changing to the prompt associated with that image.
Editing the prompt will update the image it applies to.
Page refreshes preserve both images.

### Story 3: User can delete images

Hovering over an image shows a "delete" button.
When clicked, the image is removed.
Refreshing shows the image is still gone.

### Story 4: User can organize images organically

Dragging an image moves it to any location on the page.
Refreshing preserves the position.

Considerations:
Dragging bounds
Cloning near bounds

### Story 5: User can easily generate variations on an image

Hovering over an image shows a "magic" button.
When clicked, 4 new images appear with variations on the base image.
Refreshing preserves new images.

Considerations:
Layout and bounds
Variations should appear almost immediately
Handling generative response errors
Ensure API key hygiene
Protect exposed api routes (deferred)

Generative Considerations:
Model selection, cognitive requirements are low, speed is valued
Prompting, experiment with JSON responses compared to simple newline delineated text responses with single or few shot examples

### Story 6: User can easily manage workspace

Clicking a workspace arrange button organizes all images in a grid.
Clicking a workspace clear button deletes all images.
All changes are persisted.

## Further exploration

- Real-time collaboration
- Controlling image generation with ControlNet
- Separate canvases into multiple project pages
- Annotation and favoriting of images
- Full size image download
- Pre-generate variation prompts (and possibly images) for immediate feedback
