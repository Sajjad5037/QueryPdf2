const pdfHighlighter = (searchTerm) => {
    const textLayers = document.querySelectorAll(".react-pdf__Page__textContent");

    textLayers.forEach((layer) => {
        layer.innerHTML = layer.innerHTML.replace(
            new RegExp(`(${searchTerm})`, "gi"),
            '<span style="background-color: yellow;">$1</span>'
        );
    });

    console.log(`Highlighted all occurrences of: ${searchTerm}`);
};

// Call this function when needed (e.g., after the PDF loads)
pdfHighlighter("your-search-term");
