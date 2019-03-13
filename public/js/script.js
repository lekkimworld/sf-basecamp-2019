window.addEventListener("load", () => {
    document.querySelectorAll("button.btn").forEach(node => {
        const href = node.getAttribute("href");
        if (href) {
            node.addEventListener("click", (event) => {
                event.preventDefault = true;
                const parts = window.location.pathname.split("/");
                const ctx = parts.length >= 3 ? `${parts[1]}` : "";
                console.log(`Path <${window.location.pathname}> and context <${ctx}> and href <${href}>`)
                window.location.href = `/${ctx}${href}`;
            })
        }
    });    
})
