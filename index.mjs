import express from 'express';
import nodemailer from 'nodemailer';
//const nodemailer = require('nodemailer');

import  { PDFDocument, StandardFonts } from 'pdf-lib';
import axios from 'axios';

import {} from 'dotenv/config';



const app = express();

app.use(express.json());

app.get('/api/hello', (req, res) => {
    res.send('Hello, World!');
});


app.post('/api/sendEmail', async (req , res) => {
    const { id, transactionId, timestamp, data, type, username } = req.body;
    
    const policyNumber = data["policyLocator"];     // policyLocator  

    // Creating Authorization token

    const response_auth = await fetch('https://api.sandbox.socotra.com/account/authenticate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            username: process.env.tenent_username,
            password: process.env.tenent_password,
            hostName: process.env.host_name,
        }),
    });

    const js_obj_auth = await response_auth.json();
    const string_json_auth = JSON.stringify(js_obj_auth);
    const parse_json_auth = JSON.parse(string_json_auth);

    const auth_token = parse_json_auth.authorizationToken;


    // Fetching policy from policyLocator

    const response_policy = await fetch("https://api.sandbox.socotra.com/policy/" + policyNumber, {
        method: 'GET',
        headers: {
            "Authorization": auth_token,
            "Content-type": "application/json; charset=UTF-8"
        },

    })

    const js_obj_policy = await response_policy.json();
    const string_json_policy = JSON.stringify(js_obj_policy);
    const parse_json_policy = JSON.parse(string_json_policy);

    const recipientEmail = parse_json_policy.characteristics[0].fieldValues.email_field_example;

    const doc = parse_json_policy.documents[0].url;
    

    async function convertURLToPDF(doc) {
        try {
            const response = await axios.get(doc, {
            responseType: 'arraybuffer',
        });

        const pdfDoc = await PDFDocument.create();
        const pdfBytes = response.data;

        const externalPdf = await PDFDocument.load(pdfBytes);
        const externalPages = await pdfDoc.copyPages(externalPdf, externalPdf.getPageIndices());
        externalPages.forEach((page) => pdfDoc.addPage(page));

    
    
        const pdfBytesWithAttachments = await pdfDoc.save({ useObjectStreams: false });
        return pdfBytesWithAttachments;
        } catch (error) {
            console.error('Error converting URL to PDF:', error);
            throw error;
        }
    }

    async function sendEmailWithAttachment(pdfBytesWithAttachments, recipientEmail) {
        try {
            const transporter = nodemailer.createTransport({
            service: 'hotmail',
            auth: {
                user: process.env.sender_email_address,
                pass: process.env.sender_password,
            },
            tls: {
        // do not fail on invalid certs
        rejectUnauthorized: false
    },
        });

        const mailOptions = {
            from: process.env.sender_email_address,
            to: recipientEmail,
            subject: 'Policy Documents',
            text: 'PFA',
            attachments: [
                {
                    filename: 'attachment.pdf',
                    content: pdfBytesWithAttachments,
                },
            ],
        };

        const result = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', result);
        } catch (error) {
            console.error('Error sending email:', error);
            throw error;
        }
    }
    convertURLToPDF(doc)
        .then((pdfBytesWithAttachments) => {
            sendEmailWithAttachment(pdfBytesWithAttachments, recipientEmail);

      })
     .catch((error) => {
        // Handle any errors that occurred during the conversion
    });

    res.status(200).json({ message: 'Request received successfully' });
});


// endpoint for data autofill for Zipcode.

app.post('/api/autofill', async (req, res) => {

    // Access the request body data
    const { operationType, opertaion, updates, productName, policyholderLocator } = req.body;

    const zip_code = updates.fieldValues.ZIP_Code;

    const url = 'https://us-zip-code-information.p.rapidapi.com/?zipcode=' + zip_code;
    const options = {
        method: 'GET',
        headers: {
            'X-RapidAPI-Key': process.env.api_key,
            'X-RapidAPI-Host': 'us-zip-code-information.p.rapidapi.com'
        }
    };

    try {
        const response = await fetch(url, options);
        
        const js_obj = await response.json();
        const string_json = JSON.stringify(js_obj);
        const parse_json = JSON.parse(string_json);

        const result = {
            State: parse_json[0].State,
            City_Town: parse_json[0].City
        }

        //console.log(fieldValues);

        res.status(201).json({fieldValues : result}); 

    } catch (error) {
        console.error(error);
    }


    //res.status(201).json({ message: 'success' });
});


app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
