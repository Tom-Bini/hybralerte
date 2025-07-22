document.addEventListener("DOMContentLoaded", function () {
    const input = document.querySelector("#wallet"); // adapte si ton champ a un autre ID

    if (!input) return;

    input.addEventListener("change", async () => {
        const address = input.value.trim();

        // Validation de base
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
            console.log("Adresse EVM invalide");
            return;
        }

        try {
            const res = await fetch("http://localhost:5000/submit-address", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ address })
            });

            const data = await res.json();

            if (data.success) {
                console.log("Adresse enregistrée !");
            } else {
                console.log("Erreur :", data.error);
            }
        } catch (err) {
            console.error("Erreur réseau :", err);
        }
    });
});
