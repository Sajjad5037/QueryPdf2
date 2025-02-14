import { Document, Page,pdfjs } from "react-pdf";
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;


const PdfViewer = ({ pdfUrl, pageNumber }) => {
  return (
    <div
      style={{
        width: "300px",
        marginLeft: "30px",
        padding: "20px",
        backgroundColor: "#f9f9f9",
        borderRadius: "8px",
        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
      }}
    >
      <h3 style={{ textAlign: "center", color: "#333" }}>
        Model Knowledge Reference
      </h3>
      <div
        style={{
          height: "475px",
          overflowY: "scroll",
          border: "1px solid #ddd",
          padding: "10px",
          borderRadius: "8px",
          backgroundColor: "#fff",
        }}
      >
        {pdfUrl ? (
          <Document file={pdfUrl} loading="Loading PDF...">
            <Page pageNumber={pageNumber} />
          </Document>
        ) : (
          <p style={{ textAlign: "center", color: "#777" }}>
            No PDF selected
          </p>
        )}
      </div>
    </div>
  );
};

export default PdfViewer;
