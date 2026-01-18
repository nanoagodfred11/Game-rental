/**
 * Game Images Configuration
 * ========================================
 * Update the image URLs here and they will be applied
 * across all pages automatically.
 * 
 * To update an image:
 * 1. Find the game in the list below
 * 2. Replace the 'poster' URL with your new image URL
 * 3. Save the file and refresh the page
 */

const GAME_IMAGES = {
    // Sports Games
    ea_fc_26: {
        name: "EA Sports FC 26",
        category: "Sports",
        poster: "images/games/ea fc 26.jpg"
    },
    nba_2k24: {
        name: "NBA 2K26",
        category: "Sports",
        poster: "images/games/NBA_2K26_Cover.jpg"
    },

    // Action Games
    gta_v: {
        name: "GTA V",
        category: "Action",
        poster: "images/games/grand-theft-auto-vi-store-01-en-06may25.jpg"
    },
    spider_man_2: {
        name: "Spider-Man 2",
        category: "Action",
        poster: "images/games/spider-man-2-keyart-01-en-7june24.jpg"
    },

    // Adventure Games
    god_of_war: {
        name: "God of War Ragnarök",
        category: "Adventure",
        poster: "https://media.rawg.io/media/games/4be/4be6a6ad0364751a96229c56bf69be59.jpg"
    },
    mortal_kombat_11: {
        name: "Mortal Kombat 11 Ultimate",
        category: "Fighting",
        poster: "images/games/mortal-kombat-11-ultimate-ultimate-pc-game-steam-cover (1).jpg"
    },
    last_of_us: {
        name: "The Last of Us Part I",
        category: "Adventure",
        poster: "https://media.rawg.io/media/games/a6c/a6ccd34125c594abf1a9c9821b9a715d.jpg"
    },

    // Shooter Games
    cod_mw3: {
        name: "Call of Duty: MW3",
        category: "Shooter",
        poster: "https://media.rawg.io/media/games/b34/b3419c2706f8f8dbe40d08e23642ad06.jpg"
    },

    // RPG Games
    hogwarts_legacy: {
        name: "Hogwarts Legacy",
        category: "RPG",
        poster: "images/games/Halo-CE-packshot-01-en-10oct25.jpg"
    },
    ghost_of_yotei: {
        name: "Ghost of Yotei",
        category: "RPG",
        poster: "images/games/ghost of yotei.jpg"
    },

    // Fighting Games
    mortal_kombat_1: {
        name: "Mortal Kombat 1",
        category: "Fighting",
        poster: "https://media.rawg.io/media/games/fc8/fc839beb76bd63c2a5b176c46bdb7681.jpg"
    },

    // Horror Games
    resident_evil_4: {
        name: "Resident Evil 4",
        category: "Horror",
        poster: "https://media.rawg.io/media/games/951/951572a3dd1e42544bd39a5d5b42d234.jpg"
    }
};

// Background images for poster grid (used on homepage and other pages)
const BACKGROUND_IMAGES = [
    GAME_IMAGES.spider_man_2.poster,
    GAME_IMAGES.god_of_war.poster,
    GAME_IMAGES.gta_v.poster,
    GAME_IMAGES.ea_fc_26.poster,
    GAME_IMAGES.nba_2k24.poster,
    GAME_IMAGES.cod_mw3.poster,
    GAME_IMAGES.hogwarts_legacy.poster,
    GAME_IMAGES.mortal_kombat_1.poster,
    GAME_IMAGES.mortal_kombat_11.poster,
    GAME_IMAGES.last_of_us.poster,
    GAME_IMAGES.resident_evil_4.poster,
    GAME_IMAGES.ghost_of_yotei.poster
];

// Featured games order (for homepage)
const FEATURED_GAMES = [
    'ea_fc_26',
    'gta_v',
    'god_of_war',
    'spider_man_2',
    'nba_2k24',
    'cod_mw3',
    'hogwarts_legacy',
    'mortal_kombat_1',
    'mortal_kombat_11',
    'last_of_us',
    'resident_evil_4',
    'ghost_of_yotei'
];

// Helper function to get game info
function getGameInfo(gameKey) {
    return GAME_IMAGES[gameKey] || null;
}

// Helper function to get all games as array
function getAllGames() {
    return Object.entries(GAME_IMAGES).map(([key, game]) => ({
        key,
        ...game
    }));
}

// Helper function to render featured games grid
function renderFeaturedGames(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = FEATURED_GAMES.map(key => {
        const game = GAME_IMAGES[key];
        if (!game) return '';
        return `
            <div class="game-card">
                <img src="${game.poster}" alt="${game.name}" loading="lazy">
                <div class="game-card-content">
                    <h3 class="font-bold text-base mb-1">${game.name}</h3>
                    <p class="text-xs text-accent">${game.category}</p>
                </div>
            </div>
        `;
    }).join('');
}

// Helper function to render games library (smaller grid)
function renderGamesLibrary(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = FEATURED_GAMES.map(key => {
        const game = GAME_IMAGES[key];
        if (!game) return '';
        // Short name for small display
        const shortName = game.name.length > 15 ? game.name.substring(0, 12) + '...' : game.name;
        return `
            <div class="group relative rounded-lg overflow-hidden">
                <img src="${game.poster}" alt="${game.name}" class="w-full aspect-square object-cover group-hover:scale-110 transition">
                <div class="absolute inset-0 bg-dark/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <span class="text-xs font-bold text-center px-1">${shortName}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Helper function to set background poster grid
function setBackgroundPosters() {
    const bgGrid = document.querySelector('.poster-grid-bg');
    if (!bgGrid) return;

    bgGrid.innerHTML = BACKGROUND_IMAGES.map(url => 
        `<img src="${url}" alt="" loading="lazy">`
    ).join('');
}

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Set background posters if element exists
    setBackgroundPosters();
    
    // Render featured games if container exists
    renderFeaturedGames('featured-games-grid');
    
    // Render games library if container exists
    renderGamesLibrary('games-library-grid');
});
