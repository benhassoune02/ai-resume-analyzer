import Navbar from "~/components/Navbar";
import { useState, type FormEvent } from "react";
import FileUploader from "~/components/FileUploader";
import {usePuterStore} from "~/lib/puter";
import {useNavigate} from "react-router";
import {convertPdfToImage} from "~/lib/pdf2image";
import {generateUUID} from "~/lib/utils";
import {prepareInstructions} from "../../constants";


const Upload = () => {

    const {auth, isLoading, fs, ai, kv} = usePuterStore();
    const navigate = useNavigate();
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [file, setFile] = useState<File | null>(null);

    const handleFileSelect = (file: File | null) => {
        setFile(file);
    }


    const handleAnalyze = async ({ companyName, jobTitle , jobDescription , file }: { companyName: string, jobTitle: string , jobDescription: string , file: File }) => {
        setIsProcessing(true);
        setStatusText('Uploading the file...');

        const UploadedFile = await fs.upload([file]);
        if(!UploadedFile) return setStatusText('Error: Failed to upload');

        setStatusText('Converting to image...');const imageResult = await convertPdfToImage(file);

        if (!imageResult.file) {
            return setStatusText(
                imageResult.error || 'Error: Failed to convert PDF to image'
            );
        }

        setStatusText('Uploading the image...');

        const uploadedimage = await fs.upload([imageResult.file]);

        if (!uploadedimage) {
            return setStatusText('Error: Failed to upload image');
        }

        setStatusText('Preparing data...');


        const uuid = generateUUID();
        const data ={
            id: uuid,
            resumePath: uploadedimage.path,
            imagePath: uploadedimage.path,
            companyName, jobTitle, jobDescription,
            feedback: '',
        }

        await kv.set(`resume: &{uuid}`, JSON.stringify(data));

        setStatusText('Analyzing...');

        try {
            console.log("Uploaded PDF:", UploadedFile);
            console.log("PDF path:", UploadedFile.path);

            const instructions = prepareInstructions({
                jobTitle,
                jobDescription
            });

            console.log("Instructions:", instructions);

            const feedback = await ai.feedback(
                UploadedFile.path,
                instructions
            );

            console.log("AI feedback:", feedback);

            if (!feedback) {
                return setStatusText('Error: Failed to analyze resume');
            }

            const feedbackText =
                typeof feedback.message.content === 'string'
                    ? feedback.message.content
                    : feedback.message.content[0].text;

            data.feedback = JSON.parse(feedbackText);

            await kv.set(`resume:${uuid}`, JSON.stringify(data));

            setStatusText('Analysis completed, redirecting...');
            console.log("Final data:", data);

        } catch (error) {
            console.error("AI ANALYSIS ERROR:", error);
            setStatusText('Error: Failed to analyze resume');
        }
    }

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget.closest('form');

        if(!form) return;
        const formData = new FormData(form);

        const companyName = formData.get('company-name') as string;
        const jobTitle = formData.get('job-title') as string;
        const jobDescription = formData.get('job-description') as string;

        if(!file) return;

        handleAnalyze({ companyName, jobTitle, jobDescription , file } );
    }
    return (
        <main className="bg-[url('/images/bg-main.svg')] bg-cover">
            <Navbar />

            <section className="main-section">
                <div className="page-heading py-16">
                    <h1>Smart feedback for your dream job</h1>
                    {isProcessing ? (
                        <>
                            <h2>{statusText}</h2>
                            <img src="/images/resume-scan.gif" className="w-full"/>
                        </>
                    ) : (
                        <h2>Drop your resume for An ATS score and improvement tips</h2>
                    )}

                    {!isProcessing && (
                        <form id="upload-form" onSubmit={handleSubmit} className="flex flex-col gap-4 mt-8">
                            <div className="form-div">
                                <label htmlFor="company-name">
                                   Company Name
                                </label>
                                <input type="text" name="company-name" placeholder="Company Name" id="company-name" />
                            </div>
                            <div className="form-div">
                                <label htmlFor="job-title">
                                    Job Title
                                </label>
                                <input type="text" name="job-title" placeholder="Job Title" id="job-title" />
                            </div>
                            <div className="form-div">
                                <label htmlFor="job-description">
                                    Job Description
                                </label>
                                <textarea rows={5} name="job-description" placeholder="Job description" id="job-description" />
                            </div>
                            <div className="form-div">
                                <label htmlFor="uploader">
                                    Uploader Resume
                                </label>
                                <FileUploader onFileSelect={handleFileSelect} />
                                <button className="primary-button" type="submit">
                                    Analyze resume
                                </button>
                            </div>

                        </form>
                    )}
                </div>
            </section>
        </main>
    )
}

export default Upload;