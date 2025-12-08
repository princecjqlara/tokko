import { ContactRecord } from "./types";

export async function sendMessageToContact(
  pageAccessToken: string,
  contact: ContactRecord,
  message: string,
  attachment: any,
  messageTag: string
) {
  const firstName = contact.contact_name?.split(" ")[0] || "there";
  const personalizedMessage = message.replace(/{FirstName}/g, firstName);

  let messageSent = false;
  let lastError: string | null = null;

  if (attachment && attachment.url) {
    try {
      const attachmentType = attachment.type || "file";
      const mediaPayload: any = {
        recipient: { id: contact.contact_id },
        message: {
          attachment: {
            type: attachmentType,
            payload: { url: attachment.url, is_reusable: true }
          }
        },
        messaging_type: "MESSAGE_TAG",
        tag: messageTag
      };

      const mediaResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mediaPayload)
        }
      );

      const mediaData = await mediaResponse.json();
      if (mediaResponse.ok && !mediaData.error) {
        messageSent = true;
      } else {
        lastError = mediaData.error?.message || `Failed to send ${attachmentType}`;
      }
    } catch (error: any) {
      lastError = error?.message || "Failed to send media";
    }
  } else {
    try {
        const textPayload: any = {
          recipient: { id: contact.contact_id },
          message: { text: personalizedMessage },
          messaging_type: "MESSAGE_TAG",
          tag: messageTag
        };

      const textResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(textPayload)
        }
      );

      const textData = await textResponse.json();
      if (textResponse.ok && !textData.error) {
        messageSent = true;
      } else {
        lastError = textData.error?.message || "Failed to send text";
      }
    } catch (error: any) {
      lastError = error?.message || "Failed to send text";
    }
  }

  return {
    success: messageSent,
    attachmentSent: attachment && attachment.url ? messageSent : false,
    error: messageSent ? null : lastError
  };
}
