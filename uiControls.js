let darkMode = false;
let goofyMode = false;

const standardSound = "sound_effect.mp3";
const goofySound = "sound_goofy.mp3";

const sound = document.getElementById("alertSound");
const themeBtnIcon = document.querySelector("#toggleThemeBtn i");
const soundBtnIcon = document.querySelector("#toggleSoundBtn i");

document.getElementById("toggleThemeBtn").addEventListener("click", () => {
    darkMode = !darkMode;
    document.body.classList.toggle("dark-mode", darkMode);
    themeBtnIcon.className = darkMode ? "fa-solid fa-sun" : "fa-solid fa-moon";
});

document.getElementById("toggleSoundBtn").addEventListener("click", () => {
    goofyMode = !goofyMode;
    sound.src = goofyMode ? goofySound : standardSound;
    soundBtnIcon.className = goofyMode ? "fa-solid fa-drumstick-bite" : "fa-solid fa-volume-high";
});
