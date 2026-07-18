/* eslint-disable react/no-array-index-key */
import React from "react";
import { Link, Typography } from "@mui/material";
import ListSimple from "./ListSimple";
// import Typography from "./Typography";

function ApplyStyle(key, value) {
  switch (key) {
    case "title":
      return (
        <Typography
          variant="h4"
          align="center"
          color="secondary.main"
          sx={{ my: 5 }}
        >
          {value}
        </Typography>
      );

    case "text7ab":
    case "text7a":
    case "text8":
    case "text11":
    case "text13":
    case "text14":
    case "text3":
    case "text21":
    case "text22":
      return (
        <Typography
          variant="bodyLarge"
          paragraph
          color="secondary.main"
          style={{ whiteSpace: "pre-line" }}
        >
          {(typeof value === "string" ? value : "")
            ?.split(/(\{.*?\})/)
            ?.map((part, index) => {
              // Check if the part should be rendered as italic span
              if (part.startsWith("{") && part.endsWith("}")) {
                const italicContent = part.substring(1, part.length - 1);

                if (italicContent.includes("@")) {
                  return (
                    <Link
                      key={index}
                      href={`mailto:${italicContent}`}
                      color="primary.main"
                    >
                      {italicContent}
                    </Link>
                  );
                }

                return (
                  <Typography
                    key={index}
                    component="span"
                    variant="bodyLarge"
                    fontStyle="italic"
                    color="secondary.main"
                    style={{ textDecoration: "underline" }}
                  >
                    {italicContent}
                  </Typography>
                );
              }

              // Check if the part contains a URL
              const urlRegex = /(https?:\/\/[^\s]+)/g;
              if (urlRegex.test(part)) {
                return part.split(urlRegex)?.map((subPart, subIndex) => {
                  if (urlRegex.test(subPart)) {
                    return (
                      <Link
                        key={`${index}-${subIndex}`}
                        href={subPart}
                        target="_blank"
                        rel="noopener noreferrer"
                        color="primary.main"
                      >
                        here
                      </Link>
                    );
                  }
                  return subPart;
                });
              }

              return part;
            })}
        </Typography>
      );

    case "text7red":
      return (
        <Typography
          variant="h6"
          sx={{ my: 2, color: "red", textEmphasis: "uppercase" }}
        >
          {value}
        </Typography>
      );
    case "text7green":
      return (
        <Typography variant="h6" sx={{ my: 2 }} color="secondary.main">
          {value}
        </Typography>
      );
    case "subtitle1":
    case "subtitle2":
    case "subtitle3":
    case "subtitle4":
    case "subtitle5":
    case "subtitle6":
    case "subtitle7":
    case "subtitle8":
    case "subtitle9":
    case "subtitle10":
    case "subtitle11":
    case "subtitle12":
    case "subtitle13":
    case "subtitle14":
    case "subtitle15":
    case "subtitle16":
      return (
        <Typography variant="h6" sx={{ my: 2 }} color="secondary.main">
          {value}
        </Typography>
      );
    case "subtitle1bold":
    case "subtitle2bold":
    case "subtitle3bold":
    case "subtitle4bold":
    case "subtitle5bold":
    case "subtitle6bold":
    case "subtitle7bold":
    case "subtitle8bold":
    case "subtitle9bold":
    case "subtitle10bold":
    case "subtitle11bold":
    case "subtitle12bold":
    case "subtitle13bold":
    case "subtitle14bold":
    case "subtitle15bold":
    case "subtitle16bold":
    case "subtitle17bold":
    case "subtitle18bold":
      return (
        <Typography
          variant="h5"
          fontWeight="bold"
          paragraph
          color="secondary.main"
          sx={{ my: 1 }}
        >
          {value}
        </Typography>
      );
    case "ul2":
    case "ul3":
    case "ul4":
    case "ul5":
    case "ul6":
    case "ul7":
    case "ul8":
    case "ul9":
    case "ul12":
    case "ul14":
    case "ul15":
    case "ul16":
      //      return <ListSimple items={value} icon="/icons/arrow6.png" />;
      return <ListSimple items={value} icon="/icons/arrowv.png" />;
    case "text14bold":
      return (
        <Typography
          variant="h5"
          fontWeight="bold"
          color="secondary.main"
          sx={{ my: 2, textEmphasis: "uppercase" }}
        >
          {value}
        </Typography>
      );
    case "textItalic9":
    case "textItalic12":
    case "textItalic14":
    case "textItalic20a":
    case "textItalic19a":
    case "textItalic18a":
    case "textItalic17a":
    case "textItalic16":
    case "textItalic15a":
    case "textItalic15":
    case "textItalic13":
      return (
        <Typography variant="bodyLarge" fontStyle="italic" color="secondary.main">
          {value}
        </Typography>
      );
    case "textItalicUnderline1":
      return (
        <Typography
          variant="bodyLarge"
          fontStyle="italic"
          textDecoration="underline"
          color="secondary.main"
        >
          {value}
        </Typography>
      );
    case "textWithLinks1":
      return (
        <Typography
          variant="bodyLarge"
          paragraph
          color="secondary.main"
          style={{ whiteSpace: "pre-line" }}
        >
          {(typeof value === "string" ? value : "")
            ?.split(/(\{.*?\})/) // Split on curly braces
            ?.map((part, index) => {
              // Match format {link|custom text}
              const linkWithTextRegex = /\{(https?:\/\/[^\s]+)\|([^}]+)\}/;
              const urlRegex = /(https?:\/\/[^\s]+)/g;
              // Check if part matches custom link format
              const match = part.match(linkWithTextRegex);
              if (match) {
                const [, url, displayText] = match;
                return (
                  <Link
                    key={`${index}`}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    color="primary.main"
                  >
                    {displayText}
                  </Link>
                );
              }

              return part; // Return plain text parts as-is
            })}
        </Typography>
      );
    default:
      return (
        <Typography
          variant="bodyLarge"
          paragraph
          color="secondary.main"
          style={{ whiteSpace: "pre-line" }}
        >
          {value}
        </Typography>
      );
  }
}

export default ApplyStyle;
