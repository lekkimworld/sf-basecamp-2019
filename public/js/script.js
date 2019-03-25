const postStateMessage = (action, data) => {
    // create payload
    const payload = Object.assign({
        action
    }, data);

    // post to update state
    return fetch(document.location.href, {
        "method": "post", 
        "headers": {
            "Content-Type": "application/json"
        },
        "body": JSON.stringify(payload)
    }).then(res => res.json()).then(data => {
        if (data.status === "ok") {
            window.location.reload();
            return Promise.resolve();
        } else {
            return Promise.reject(Error(data.error));
        }
    })
}
window.addEventListener("load", () => {
    document.querySelectorAll("button.btn").forEach(node => {
        const action = node.getAttribute("action");
        if (action) {
            node.addEventListener("click", (event) => {
                // prevent default event
                event.preventDefault = true;
                postStateMessage(action);
            })
        }
    });    
})
