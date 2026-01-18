====================================
    GAME IMAGES FOLDER
====================================

HOW TO ADD YOUR OWN IMAGES:

1. Copy your game poster images into the "games" folder
   Example: games/gta6.jpg, games/fc26.png

2. Open js/images.js and update the poster URL to use:
   poster: "images/games/your-image-name.jpg"

EXAMPLE:
--------
If you add a file called "gta6-poster.webp" to the games folder,
update images.js like this:

    gta_v: {
        name: "GTA VI",
        category: "Action",
        poster: "images/games/gta6-poster.webp"
    },

SUPPORTED FORMATS:
- .jpg / .jpeg
- .png
- .webp
- .gif

RECOMMENDED SIZE:
- Featured games: 600x800 pixels (3:4 ratio)
- Background grid: 400x300 pixels
- Games library: 300x300 pixels (square)

====================================
