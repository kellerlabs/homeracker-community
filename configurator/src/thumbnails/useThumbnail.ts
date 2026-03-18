import { useState, useEffect } from "react";
import {
  generateThumbnail,
  generateThumbnailFromGeometry,
  getCachedThumbnail,
} from "./ThumbnailGenerator";
import { isCustomPart, getCustomPartGeometry } from "../data/custom-parts";
import { PART_COLORS } from "../constants";
import type { PartDefinition } from "../types";

/** React hook that lazily generates and caches a part thumbnail. */
export function useThumbnail(part: PartDefinition): string | null {
  const key = isCustomPart(part.id) ? part.id : part.modelPath;
  const [dataURL, setDataURL] = useState<string | null>(() =>
    getCachedThumbnail(key)
  );

  useEffect(() => {
    if (dataURL) return;

    if (isCustomPart(part.id)) {
      const geometry = getCustomPartGeometry(part.id);
      if (geometry) {
        const url = generateThumbnailFromGeometry(
          part.id,
          geometry,
          PART_COLORS.custom
        );
        setDataURL(url);
      }
    } else if (part.modelPath) {
      generateThumbnail(part.modelPath).then(setDataURL).catch(() => {});
    }
  }, [key, part.id, part.modelPath, dataURL]);

  return dataURL;
}
