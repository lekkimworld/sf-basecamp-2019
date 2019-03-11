window.addEventListener("load", () => {
    document.querySelectorAll("button.btn").forEach(node => {
        const href = node.getAttribute("href");
        if (href) {
            node.addEventListener("click", () => {
                window.location.href = href;
            })
        }
    });    
})
