const express = require('express');
const app = express();

// var http = require("http");

const {google} = require ('googleapis');

const {
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI,
    REFRESH_TOKEN,
} = require("./credentials")

const oAuth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI,
);

oAuth2Client.setCredentials({refresh_token : REFRESH_TOKEN});

const repliedUsers = new Set();

async function checkEmailAndSendReplies() {
    try {
        const gmail = google.gmail({version: "v1", auth : oAuth2Client});

        const res = await gmail.users.messages.list({
            userId: "me",
            q: "is:unread",
        });
        const messages = res.data.messages;

        if(messages && messages.length > 0)
        {
            for (const message of messages)
            {
                const email = await gmail.users.messages.get({
                    userId: "me",
                    id: message.id,
                });
                const from = email.data.payload.headers.find((header) => header.name == "From");

                const toHeader = email.data.payload.headers.find((header) => header.name == "To");

                const Subject = email.data.payload.headers.find((header) => header.name == "Subject");
                
                const From = from.values;
                const toEmail = toHeader.values;
                const subject = Subject.values;
                console.log("Email received From ", From);
                console.log("To Email ", toEmail );

                if(!repliedUsers.has(From))
                {
                    console.log("Already Replied to : ", From);
                    continue;
                }

                const thread = await gmail.user.threads.get({
                    userId: "me",
                    id: email.data.threadId,
                });
                
                const replies = thread.data.messages.slice(1);

                if(replies.length === 0)
                {
                    await gmail.user.messages.send(
                        {
                            userId: "me",
                            requestBody: {
                                raw: await creatrReplyRaw(toEmail, From, subject),
                            },
                        }
                    );

                    const labelName = "onVAcation";
                    await gmail.users.messages.modify({
                        userId: "me",
                        id: message.id,
                        requestBody: {
                            addLabelIds: [await createLableIfNeeded(labelName)],
                        },
                    });
                    
                    console.log("Replied to : ", From);
                    repliedUsers.add(From);
                }
        }
    }
} catch (error){
    console.error("Error detected : ",error);
}
}

async function creatrReplyRaw(from, to, subject) {
    const emailContent = `From: ${from} \nTo: ${to}\nSubject: ${subject}\n\nThank you for your mail. I am out of town right now, but  will contact you soon ...`;

    const base64EncodedEmail = Buffer.from(emailContent)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

    return base64EncodedEmail;
}

async function createLableIfNeeded(labelName){
    const gmail = google.gmail({version: "v1", auth : oAuth2Client});

    const res = await gmail.users.labels.list({
        userId: "me",
    });

    const labels = res.data.labels;

    const existingLabel = labels.find((label) => label.name === labelName);

    if(existingLabel){ 
        return existingLabel.id;
    }

    const newLabel = await gmail.users.labels.create({
        userId: "me",
        requestBody: {
            name: labelName,
            labelListVisibility: "labelShow",
            messageListVisibility: "show",
        },
    });

    return newLabel.data.id;
}

function getRandomInterval(min,max)
{
    return Math.floor(Math.random() * (max-min + 1) + min);
}

setInterval(checkEmailAndSendReplies, getRandomInterval(45, 120)*1000);


app.listen(5001, ()=> {
    console.log("Server is started");
})