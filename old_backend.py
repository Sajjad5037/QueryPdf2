from flask import Flask, send_from_directory,request,jsonify,url_for
from flask_cors import CORS
import fitz 
import os,re
app = Flask(__name__, static_folder="build")
import joblib
from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import FAISS
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.prompts import PromptTemplate
from langchain.chat_models import ChatOpenAI
from langchain.chains import RetrievalQA

CORS(app)  # Enable CORS to allow requests from frontend

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
vectorStore=None
BASE_URL = "http://localhost:8000"
UPLOADS_FOLDER = "uploads" 


class Document:
    def __init__(self, page_content, metadata=None, doc_id=None):
        self.page_content = page_content
        self.metadata = metadata or {}
        self.id = doc_id or str(id(self))  # Generate a unique ID if not provided

    def set_page_number(self, page_number):
        """Set the page number in the metadata."""
        self.metadata["page_number"] = page_number

    def get_page_number(self):
        """Get the page number from the metadata."""
        return self.metadata.get("page_number", "Page number not available")


def clean_extracted_text(text):
    if text is None:
        return ""
    
    # Step 1: Replace newline characters with spaces
    cleaned_text = text.replace('\n', ' ')
    
    # Step 2: Add space between lowercase and uppercase letters
    # This pattern detects transitions from lowercase to uppercase, commonly used in concatenated words
    cleaned_text = re.sub(r'([a-z])([A-Z])', r'\1 \2', cleaned_text)
    
    
    # Step 4: Remove any extra spaces (multiple spaces or spaces at the beginning/end)
    cleaned_text = re.sub(r'\s+', ' ', cleaned_text).strip()
    
    return cleaned_text


def extract_text_from_pdf(pdf_path, target_page=None):
    
    pdf_text = {}
    try:
        pdf_name = pdf_path.split('/')[-1]  # Extract the PDF file name from the path
        pdf_text = {pdf_name: {}}  # Initialize the nested dictionary with the PDF name as the key
        text = ""
        
        # Open the PDF with PyMuPDF (fitz)
        doc = fitz.open(pdf_path)
        
        # If a specific target page is provided
        if target_page:
            try:
                if 1 <= target_page <= len(doc):  # Ensure the page exists
                    page = doc.load_page(target_page - 1)  # Zero-based indexing
                    text += page.get_text()
                    text = clean_extracted_text(text)  # Assuming clean_extracted_text is defined elsewhere
                    pdf_text[pdf_name][target_page] = text
                else:
                    print(f"Page {target_page} is out of range. This PDF has {len(doc)} pages.")
            except Exception as e:
                print(f"Error processing target page {target_page} in {pdf_name}: {e}")
        
        else:
            # Read a specific range of pages (e.g., pages 4 to 6)
            try:
                for page_number in range(3, 6):  # pages 4 to 6 (0-indexed, so 3:6)
                    page = doc.load_page(page_number)
                    text += page.get_text()
                    pdf_text[pdf_name][page_number + 1] = text  # 1-indexed page numbers
            except Exception as e:
                print(f"Error reading pages 4 to 6 in {pdf_name}: {e}")
        
        return pdf_text
    
    except Exception as e:
        print(f"Error opening PDF {pdf_path}: {e}")
        return {}

def create_or_load_vectorstore(pdf_text, vectorstore_path="vectorstore.faiss", embeddings_path="embeddings.pkl"):

    try:
        if os.path.exists(vectorstore_path) and os.path.exists(embeddings_path):
            print("Loading existing vector store and embeddings...")

            # Load the saved embeddings parameters
            embeddings_params = joblib.load(embeddings_path)

            # Initialize embeddings using the saved API key
            embeddings = OpenAIEmbeddings(openai_api_key=embeddings_params["Your_openApi_Key"])

            # Load the saved vector store (FAISS index)
            vectorstore = FAISS.load_local(vectorstore_path, embeddings, allow_dangerous_deserialization=True)

        else:
            print("Creating new vector store and embeddings...")

            # Initialize text splitter
            text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)

            # Create a list to store chunks with their metadata
            documents_with_page_info = []

            for pdf_name, page_content in pdf_text.items():
                for page_number, content in page_content.items():
                    text = page_content[page_number]
                    if text.strip():  # Skip empty pages
                        for chunk in text_splitter.split_text(text):
                            # Create a Document with metadata containing the page number and PDF name
                            document_with_page_info = Document(
                                page_content=chunk,
                                metadata={"pdf_name": pdf_name, "page_number": page_number}
                            )
                            documents_with_page_info.append(document_with_page_info)

            # Generate embeddings and create vector store
            embeddings = OpenAIEmbeddings(openai_api_key="Your_openApi_Key")
            vectorstore = FAISS.from_documents(documents_with_page_info, embeddings)

            # Save vector store and embeddings for future use
            vectorstore.save_local(vectorstore_path)  # Saving the FAISS index
            embeddings_params = {"Your_openApi_Key": embeddings.openai_api_key}
            joblib.dump(embeddings_params, embeddings_path)

        return vectorstore, embeddings

    except Exception as e:
        # Handle any exceptions and display them in a messagebox
        error_message = f"An error occurred while loading or creating the vector store: {str(e)}"
        print(error_message)

def create_qa_chain(vectorstore, question):
    # Define a prompt template
    prompt = PromptTemplate(
        template="""You are a helpful assistant. Use the following retrieved context to answer the user's query:
        Context: {context}
        Question: {question}
        Answer:""",
        input_variables=["context", "question"]
    )

    # Set up the retrieval-augmented QA chain
    retriever = vectorstore.as_retriever()
    llm = ChatOpenAI(model="gpt-3.5-turbo", openai_api_key="Your_openApi_Key")
    qa_chain = RetrievalQA.from_chain_type(
        llm=llm,
        retriever=retriever,
        chain_type="stuff",
        chain_type_kwargs={"prompt": prompt},
    )
    # Check available methods on the retriever object
    print(dir(retriever))

    # Retrieve the context based on the question
    #context = retriever.retrieve(question)
    # Retrieve the context using the correct method for your retriever
    context = retriever.get_relevant_documents(question)


    # Return both the qa_chain and the context
    return qa_chain, context



@app.route("/")
def serve():
    return send_from_directory("build", "index.html")


#after loading index.html, the browser requests additional resources and these requests contain paths that does not match wthe root route("/")
# so it will be handled by the second route ("/<path:path>")
@app.route("/<path:path>") 
def static_files(path):
    return send_from_directory("build", path)

@app.route("/uploads/<path:filename>")
def serve_pdf(filename):
    return send_from_directory(UPLOADS_FOLDER, filename)

@app.route("/upload", methods=["POST"])
def upload_files():
    if "pdfs" not in request.files:
        return jsonify({"message": "No file part in the request"}), 400
    
    files = request.files.getlist("pdfs")  # Get multiple files
    if not files:
        return jsonify({"message": "No files uploaded"}), 400

    saved_files = []
    for file in files:
        if file.filename == "":
            continue
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(file_path)  # Save file
        saved_files.append(file.filename)

    return jsonify({"message": "Files uploaded successfully", "files": saved_files})

@app.route('/train_model', methods=['POST'])
def train_model():
    global vectorStore
    try:    
        #step 1 collect the text 
        combined_text={}
        for filename in os.listdir("uploads"):
            if filename.lower().endswith(".pdf"):
                file_path=os.path.join("uploads",filename)
                try:
                     pdf_data = extract_text_from_pdf(file_path, 4)
                     combined_text.update(pdf_data) 
                     print()
                except Exception as e:
                        print(f"Error extracting text from {file_path}: {e}")
                        continue  
        #step 2 create the embedding and the vector store
        vectorStore, embeddings = create_or_load_vectorstore(combined_text)  
        print(vectorStore) 
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
    return jsonify({"message": "Model trained successfully!"}), 200

@app.route('/chat', methods=['POST'])
def chat():
    data = request.json  # Get JSON data from the request
    user_message = data.get('message', '')  # Extract user message

    #create the QA chain
    qa_chain,context= create_qa_chain(vectorStore,user_message) 
    #ask the question
    answer=qa_chain.run(user_message)    
    context_data=[]
    for doc in context:
        page_number = doc.metadata.get("page_number", "Page number not available")
        pdf_name=  doc.metadata.get("pdf_name", "pdf name not available")
        searchString=doc.page_content
        regex=r",\s([^,]{15,}),"

        match = re.search(regex, searchString)
        if match:
            Shortened_searchString = match.group()
        
        #Shortened_searchString=searchString[50:250]

        # Construct the correct file URL
        
        pdf_url = f"{BASE_URL}/{UPLOADS_FOLDER}/{os.path.basename(pdf_name)}"
        

    # Append to context_data
        context_data.append({"page_number": page_number, "pdf_url": pdf_url,"searchString":Shortened_searchString})    

    #Access the page number from the meta dat

    # Simple bot logic (Modify this to include actual processing)
    bot_reply = f"ChatBot: {answer}"

    response={
        "reply":bot_reply,
        "context":context_data
    }
    print(response)
    return jsonify(response) 
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000)
