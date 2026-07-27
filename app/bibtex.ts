type BibtexFields = Record<string, string>;

export type BibtexPublicationDetails = {
  venue: string;
  volumeIssuePages: string;
  year: string;
};

export type BibtexImportEntry = {
  entryType: string;
  citationKey: string;
  raw: string;
  title: string;
  year: string;
  venue: string;
  authors: string[];
  url: string;
  note: string;
  abstract: string;
};

function cleanBibtexValue(value: string) {
  return value
    .replace(/[{}]/g, "")
    .replace(/\\([&%_$#])/g, "$1")
    .replace(/~/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseBibtexFields(input: string) {
  const fields: BibtexFields = {};
  const openingIndex = input.search(/[({]/);
  if (openingIndex < 0) {
    return fields;
  }

  let index = openingIndex + 1;
  let depth = 0;

  while (index < input.length) {
    const character = input[index];
    if (character === "{" || character === "(") {
      depth += 1;
    } else if (character === "}" || character === ")") {
      if (depth === 0) {
        break;
      }
      depth -= 1;
    } else if (character === "," && depth === 0) {
      index += 1;
      break;
    }
    index += 1;
  }

  while (index < input.length) {
    while (index < input.length && /[\s,]/.test(input[index])) {
      index += 1;
    }

    const nameStart = index;
    while (index < input.length && /[\w-]/.test(input[index])) {
      index += 1;
    }
    const name = input.slice(nameStart, index).toLowerCase();
    if (!name) {
      index += 1;
      continue;
    }

    while (index < input.length && /\s/.test(input[index])) {
      index += 1;
    }
    if (input[index] !== "=") {
      continue;
    }
    index += 1;
    while (index < input.length && /\s/.test(input[index])) {
      index += 1;
    }

    let value = "";
    if (input[index] === "{") {
      index += 1;
      let valueDepth = 1;
      while (index < input.length && valueDepth > 0) {
        const character = input[index];
        if (character === "{") {
          valueDepth += 1;
        } else if (character === "}") {
          valueDepth -= 1;
        }
        if (valueDepth > 0) {
          value += character;
        }
        index += 1;
      }
    } else if (input[index] === '"') {
      index += 1;
      while (index < input.length) {
        const character = input[index];
        if (character === '"' && input[index - 1] !== "\\") {
          index += 1;
          break;
        }
        value += character;
        index += 1;
      }
    } else {
      const valueStart = index;
      while (index < input.length && input[index] !== ",") {
        index += 1;
      }
      value = input.slice(valueStart, index);
    }

    fields[name] = cleanBibtexValue(value);
  }

  return fields;
}

function splitBibtexEntries(input: string) {
  const entries: string[] = [];
  let index = 0;

  while (index < input.length) {
    const atIndex = input.indexOf("@", index);
    if (atIndex < 0) {
      break;
    }

    let openingIndex = atIndex + 1;
    while (openingIndex < input.length && /[\w-]/.test(input[openingIndex])) {
      openingIndex += 1;
    }
    while (openingIndex < input.length && /\s/.test(input[openingIndex])) {
      openingIndex += 1;
    }

    const opening = input[openingIndex];
    if (opening !== "{" && opening !== "(") {
      index = atIndex + 1;
      continue;
    }

    const closing = opening === "{" ? "}" : ")";
    let depth = 1;
    let quoted = false;
    let cursor = openingIndex + 1;

    while (cursor < input.length && depth > 0) {
      const character = input[cursor];
      const escaped = input[cursor - 1] === "\\";
      if (character === '"' && !escaped) {
        quoted = !quoted;
      } else if (!quoted) {
        if (character === opening) {
          depth += 1;
        } else if (character === closing) {
          depth -= 1;
        }
      }
      cursor += 1;
    }

    if (depth === 0) {
      entries.push(input.slice(atIndex, cursor).trim());
      index = cursor;
    } else {
      break;
    }
  }

  return entries;
}

function entryHeader(input: string) {
  const match = input.match(/^@\s*([\w-]+)\s*[({]\s*([^,\s]+)/i);
  return {
    entryType: match?.[1]?.toLowerCase() ?? "",
    citationKey: match?.[2]?.trim() ?? "",
  };
}

function formatAuthorName(value: string) {
  const name = cleanBibtexValue(value);
  const parts = name.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) {
    return name;
  }

  const [familyName, givenName, suffix] = parts;
  return [givenName, familyName, suffix].filter(Boolean).join(" ");
}

function bibtexUrl(fields: BibtexFields) {
  if (fields.url) {
    return fields.url;
  }
  if (fields.doi) {
    return `https://doi.org/${fields.doi.replace(/^https?:\/\/doi\.org\//i, "")}`;
  }
  return "";
}

export function parseBibtexEntries(input: string): BibtexImportEntry[] {
  return splitBibtexEntries(input)
    .map((raw) => {
      const { entryType, citationKey } = entryHeader(raw);
      if (
        !entryType ||
        entryType === "comment" ||
        entryType === "preamble" ||
        entryType === "string"
      ) {
        return null;
      }

      const fields = parseBibtexFields(raw);
      const venue =
        fields.journal ??
        fields.journaltitle ??
        fields.booktitle ??
        fields.publisher ??
        fields.institution ??
        "";
      const authors = (fields.author ?? "")
        .split(/\s+and\s+/i)
        .map(formatAuthorName)
        .filter(Boolean);

      return {
        entryType,
        citationKey,
        raw,
        title: fields.title || citationKey || "Untitled publication",
        year: fields.year ?? "",
        venue,
        authors,
        url: bibtexUrl(fields),
        note: fields.note ?? "",
        abstract: fields.abstract ?? "",
      };
    })
    .filter((entry): entry is BibtexImportEntry => Boolean(entry));
}

export function getBibtexPublicationDetails(
  bibtex: string,
): BibtexPublicationDetails | null {
  if (!bibtex.trim()) {
    return null;
  }

  const fields = parseBibtexFields(bibtex);
  const venue =
    fields.journal ??
    fields.journaltitle ??
    fields.booktitle ??
    fields.publisher ??
    "";
  const volume = fields.volume ?? "";
  const issue = fields.number ?? fields.issue ?? "";
  const volumeIssue = volume
    ? `${volume}${issue ? `(${issue})` : ""}`
    : issue
      ? `no. ${issue}`
      : "";
  const pages = (
    fields.pages ??
    fields.eid ??
    fields["article-number"] ??
    fields.articleno ??
    ""
  ).replace(/\s*--\s*/g, "–");

  return {
    venue,
    volumeIssuePages: [volumeIssue, pages].filter(Boolean).join(", "),
    year: fields.year ?? "",
  };
}
