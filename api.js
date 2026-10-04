import { getEndgameArr, getDropdown } from './service.js'

// Fallback opening layout (endgames.txt) used when the optional Express/MySQL
// backend at localhost:3000 is not running. Cached after first load so the
// game still boots to a standard Xiangqi opening instead of a blank page.
let _defaultOpeningPromise = null;
function loadDefaultOpening() {
    if (_defaultOpeningPromise) return _defaultOpeningPromise;
    _defaultOpeningPromise = fetch('endgames.txt')
        .then(r => r.text())
        .then(txt => getEndgameArr(txt));
    return _defaultOpeningPromise;
}

export async function fetchEndgame(id) {
    try {
        const res = await axios.get(`http://localhost:3000/api/endgames/id=${id}`);
        const data = res.data;
        const arr = getEndgameArr(data);

        return arr;
    } catch (error) {
        console.error('Error fetching data:', error);
        return await loadDefaultOpening();  // <-- game.js 拿到默认开局而不是 undefined
    }
}

export async function fetchList() {
    try {
        const res = await axios.get('http://localhost:3000/api/endgames/titles'); 
        const data = res.data; 
        getDropdown(data); 
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

