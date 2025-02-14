import React, { useState } from 'react';
import { Document, Page, pdfjs } from "react-pdf";



// Set the correct workerSrc using the version installed
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;




function App() {
  const [pdfFiles, setPdfFiles] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [pdfUploads, setPdfUploads] = useState([]);
  const [pdfUrl, setpdfUrl] = useState(null);
  const [pdfPage, setPdfPage] = useState(1);  
  const [searchTerm, setSearchTerm] = useState(""); 

  
  
  const pdfView = (pdfUrl, pdfPage) => {      
    

    setpdfUrl(pdfUrl); // Set the PDF file
    setPdfPage(Number(pdfPage)); // Set the page number
    

  };

  const pdfHighlighter = (searchTerm) => {
    setTimeout(() => {
        const textLayers = document.querySelectorAll(".react-pdf__Page__textContent");

        if (!textLayers.length) {
            console.warn("Text layer not found. Retrying...");
            return;
        }

        textLayers.forEach((layer) => {
            let textContent = layer.innerText; // Get the text content
            console.log("Layer Text:", textContent);

            if (textContent.toLowerCase().includes(searchTerm.toLowerCase())) {
                let regex = new RegExp(`(${searchTerm})`, "gi"); // Case-insensitive search
                layer.innerHTML = layer.innerHTML.replace(regex, '<span style="background-color: yellow;">$1</span>');
                console.log(`Highlighted: ${searchTerm}`);
            } else {
                console.warn(`Search term "${searchTerm}" not found in this layer.`);
            }
        });
    }, 1000);
  };


  
    

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const fileNames = files.map(file => file.name);
    setPdfFiles([...pdfFiles, ...fileNames]);

    setPdfUploads([...pdfUploads, ...files]);
    
  };
  

  const handleRemoveFile = () => {
    if (selectedFile) {
      setPdfFiles(pdfFiles.filter(file => file !== selectedFile));
      setSelectedFile(null);
    }
  };


  const handleUploadToServer = async () => {
    const formData = new FormData();
  
    pdfUploads.forEach((file) => {
      formData.append("pdfs", file); // Append actual files to FormData
    });
  
    try {
      const response = await fetch("http://127.0.0.1:8000/upload", {
        method: "POST",
        body: formData
      });
  
      if (response.ok) {
        console.log("Files uploaded successfully");
        return true
      } else {
        console.error("Upload failed");
        return false
      }
    } catch (error) {
      console.error("Error uploading file:", error);
    }
  };
  const handleTrainModel = async () => {
    
      if (pdfFiles.length === 0) {
        alert("Please upload at least one PDF file.");
        return;
      }
      // Wait for file upload to complete before training
      const uploadSuccess = await handleUploadToServer();  
      if (!uploadSuccess) {
        console.error("File upload failed. Aborting training.");
        return;
      }  
      try {
      const response = await fetch('http://127.0.0.1:8000/train_model', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pdfFiles }), // Sending the list of PDF file paths
      });
  
      if (!response.ok) {
        throw new Error('Failed to train the model');
      }
  
      const data = await response.json();
      console.log(data); // Handle the response from the backend if necessary
    } catch (error) {
      console.error('Error:', error);
    }
  };
  

  const handleChatSubmit = async () => {
    const userMessage = { text: userInput, sender: 'user' };

    // Update state with the user's message immediately
    setChatMessages(prevMessages => [...prevMessages, userMessage]);
    setUserInput('');

    try {
      const response = await fetch('http://localhost:8000/chat', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: userInput }),
      });

      const data = await response.json();
      const botMessage = { text: data.reply, sender: 'bot' };

      // Append the bot's response to the chat
      setChatMessages(prevMessages => [...prevMessages, botMessage]);
      //check what data has been received
      console.log("Backend Response:", data);


      // Extract PDF details from context
      if (data.context && data.context.length > 0) {
        const pdfUrl = data?.context?.[0]?.pdf_url || "PDF name not available";
        const pdfPage = data?.context?.[0]?.page_number || 1;
        let searchString = data?.context?.[0]?.searchString || "";
        // Call the function to update the PDF viewer
        pdfView(pdfUrl, pdfPage);
        
        setSearchTerm(searchString)
        
      }

    } catch (error) {
      console.error('Error sending message:', error);
      }
    };



    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start', 
        padding: '20px', 
        fontFamily: 'Arial, sans-serif',
        gap: '20px'
      }}>
        {/* Left Section - PDF Upload */}
        <div style={{ 
          width: '300px', 
          padding: '20px', 
          backgroundColor: '#f9f9f9', 
          borderRadius: '8px', 
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
          height: '550px'
        }}>
          <h3 style={{ textAlign: 'center', color: '#333' }}>Upload PDFs to Train the Chatbot</h3>
          <select 
            size="10" 
            style={{ width: '100%', height: '250px', padding: '10px', marginBottom: '15px', borderRadius: '5px', border: '1px solid #ccc' }}
            onChange={(e) => setSelectedFile(e.target.value)}
          >
            {pdfFiles.map((file, index) => (
              <option key={index} value={file}>{file}</option>
            ))}
          </select>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label htmlFor="fileInput" style={{
              padding: '10px 20px',
              backgroundColor: '#4CAF50',
              color: '#fff',
              borderRadius: '5px',
              cursor: 'pointer',
              textAlign: 'center'
            }}>Choose PDF</label>
            <input id="fileInput" type="file" accept="application/pdf" onChange={handleFileUpload} multiple style={{ display: 'none' }} />
            <button onClick={handleRemoveFile} style={{ padding: '10px', borderRadius: '5px', color: '#fff', backgroundColor: '#FF0000' }}>Remove</button>
            <button onClick={handleTrainModel} style={{ padding: '10px', borderRadius: '5px', color: '#fff', backgroundColor: '#4CAF50' }}>Train Model</button>
          </div>
        </div>
    
        {/* Right Section - Chatbot */}
        <div style={{ 
          flex: 1, 
          padding: '20px', 
          backgroundColor: '#f9f9f9', 
          borderRadius: '8px', 
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
          height: '550px'
        }}>
          <h2 style={{ textAlign: 'center', color: '#333', marginBottom: '15px' }}>Virtual Chatbot Assistant</h2>
          <div style={{ height: '400px', overflowY: 'scroll', marginBottom: '15px', border: '1px solid #ddd', padding: '15px', borderRadius: '8px', backgroundColor: '#fff' }}>
            {chatMessages.map((msg, index) => (
              <div key={index} style={{ marginBottom: '10px', textAlign: msg.sender === 'user' ? 'right' : 'left' }}>
                <div style={{ display: 'inline-block', backgroundColor: '#f1f1f1', padding: '10px', borderRadius: '10px' }}>{msg.text}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)}
              style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc', marginRight: '10px' }}
            />
            <button onClick={handleChatSubmit} style={{ padding: '10px 20px', borderRadius: '5px', backgroundColor: '#2196F3', color: '#fff', cursor: 'pointer' }}>Send</button>
          </div>
        </div>
    
        {/* PDF Viewer Section */}
        <div style={{ 
          width: "400px",
          padding: "20px",
          backgroundColor: "#f9f9f9",
          borderRadius: "8px",
          boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
          height: '550px'
        }}>
          <h3 style={{ textAlign: 'center', color: "#333" }}>PDF Viewer</h3>
          <div style={{
            height: "450px",
            overflowY: "scroll",
            border: "1px solid #ddd",
            padding: "10px",
            borderRadius: "8px",
            backgroundColor: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            {pdfUrl ? (
              <Document file={pdfUrl} onLoadSuccess={() => console.log("PDF Loaded")}>
                <Page 
                  pageNumber={pdfPage || 1}
                  renderTextLayer={true} 
                  onRenderSuccess={() => {
                    console.log("Text Layer Rendered");
                    setTimeout(() => pdfHighlighter(searchTerm), 1000);
                  }} 
                />
              </Document>
            ) : (
              <p style={{ color: "#777" }}>No PDF loaded. Please upload a file.</p>
            )}
          </div>
        </div>
      </div>
    );
    
}

export default App;
