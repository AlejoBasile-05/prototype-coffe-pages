"use client";

/**
 * Selección, validación, subida firmada y previsualización de la foto
 * del producto (Tarea 16 §6.5).
 *
 * El orden de los pasos no es cosmético:
 *
 *   1. El `slug` se deriva del nombre ANTES de firmar, porque la firma
 *      compromete el `public_id` final. Si el cliente pudiera elegir
 *      el slug, firmaría para la carpeta de otro producto (§5.2).
 *   2. La validación ocurre en el navegador con `validateImageFile`,
 *      una función pura de `lib` sin `server-only`, justamente para
 *      rechazar un archivo de 20 MB antes de mover un solo byte.
 *   3. La subida va **directo a Cloudinary** con la firma del servidor.
 *      Los megas del archivo nunca pasan por el Route Handler de Next:
 *      un despliegue serverless pagaría la factura (§2.3).
 *   4. El `public_id` que devuelve Cloudinary se compara con el pedido.
 *      Si no coinciden, el asset viejo ya no se puede destruir en la
 *      Tarea 21, y guardarlo en la base sería almacenar basura.
 */
import Image from "next/image";
import { useRef, useState } from "react";

import { Button } from "@/components/ui";
import { buildSlug } from "@/lib/validation/slug";
import { validateImageFile } from "@/lib/validation/imagen";

type Estado =
  | { fase: "vacio" }
  | { fase: "validando" }
  | { fase: "firmando" }
  | { fase: "subiendo" }
  | { fase: "lista"; imageUrl: string; imagePublicId: string }
  | { fase: "error"; mensaje: string };

interface ProductImageFieldProps {
  /** Nombre actual: de acá sale el slug que se firma. */
  nombre: string;
  /** Foto ya guardada, en modo edición. */
  imagenActual?: { imageUrl: string; imagePublicId: string | null };
  onChange: (imagen: { imageUrl: string; imagePublicId: string } | null) => void;
}

/**
 * Lo que la ruta `/api/admin/images/sign` devuelve.
 *
 * ⛔ `allowedFormats`, `maxFileSize` y `maxImageSize` vienen firmados con el
 *    resto (Tarea 19 §2.9). No son un extra opcional: si el `FormData` no
 *    los manda, Cloudinary rechaza la subida por firma incompleta y el
 *    allowlist de formatos deja de existir.
 */
interface FirmaDeSubida {
  readonly signature: string;
  readonly timestamp: number;
  readonly publicId: string;
  readonly cloudName: string;
  readonly apiKey: string;
  readonly overwrite: "true";
  readonly allowedFormats: string;
  readonly maxFileSize: number;
  readonly maxImageSize: number;
}

/** Lo que Cloudinary devuelve tras una subida correcta. */
interface RespuestaCloudinary {
  readonly secure_url: string;
  readonly public_id: string;
  readonly format: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
}

export const ProductImageField = ({ nombre, imagenActual, onChange }: ProductImageFieldProps) => {
  const [estado, setEstado] = useState<Estado>(
    imagenActual
      ? {
          fase: "lista",
          imageUrl: imagenActual.imageUrl,
          imagePublicId: imagenActual.imagePublicId ?? "",
        }
      : { fase: "vacio" },
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const manejarArchivo = async (file: File): Promise<void> => {
    // 1. Validar ANTES de subir: es la razón por la que la Tarea 06
    //    dejó `validateImageFile` en `lib` y no en `server`.
    try {
      validateImageFile(file);
    } catch (error) {
      setEstado({
        fase: "error",
        mensaje: error instanceof Error ? error.message : "El archivo no sirve.",
      });
      return;
    }

    setEstado({ fase: "firmando" });

    try {
      // 2. Pedir la firma con el slug que viene del nombre. NO se mira
      //    el slug que el usuario podría haber tipeado.
      const respuestaFirma = await fetch("/api/admin/images/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: buildSlug(nombre) }),
      });

      if (!respuestaFirma.ok) {
        const cuerpo = (await respuestaFirma.json()) as { error?: string };
        setEstado({
          fase: "error",
          mensaje: cuerpo.error ?? "No se pudo autorizar la subida.",
        });
        return;
      }

      const firma = (await respuestaFirma.json()) as FirmaDeSubida;

      // 3. Subir directo a Cloudinary. Los bytes no pasan por la app.
      //    ⛔ El `FormData` tiene que ser EXACTAMENTE el conjunto firmado:
      //    ni un parámetro de más, ni uno de menos.
      const body = new FormData();
      body.append("file", file);
      body.append("api_key", firma.apiKey);
      body.append("timestamp", String(firma.timestamp));
      body.append("signature", firma.signature);
      body.append("public_id", firma.publicId);
      body.append("overwrite", firma.overwrite);
      body.append("allowed_formats", firma.allowedFormats);
      body.append("max_file_size", String(firma.maxFileSize));
      body.append("max_image_size", String(firma.maxImageSize));

      setEstado({ fase: "subiendo" });

      const respuesta = await fetch(
        `https://api.cloudinary.com/v1_1/${firma.cloudName}/image/upload`,
        { method: "POST", body },
      );

      if (!respuesta.ok) {
        setEstado({ fase: "error", mensaje: "Cloudinary rechazó la imagen." });
        return;
      }

      const subido = (await respuesta.json()) as RespuestaCloudinary;

      // 4. El `public_id` devuelto se compara con el pedido. Si es otro,
      //    el asset queda sin referencia y no se borra nunca.
      if (subido.public_id !== firma.publicId) {
        setEstado({ fase: "error", mensaje: "La imagen se subió con otro nombre." });
        return;
      }

      setEstado({
        fase: "lista",
        imageUrl: subido.secure_url,
        imagePublicId: subido.public_id,
      });
      onChange({ imageUrl: subido.secure_url, imagePublicId: subido.public_id });
    } catch (error) {
      setEstado({
        fase: "error",
        mensaje: error instanceof Error ? error.message : "No se pudo subir la imagen.",
      });
    }
  };

  const esValidando = estado.fase === "validando" || estado.fase === "firmando";

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="producto-imagen" className="text-ink text-sm font-medium">
        Foto del producto
      </label>
      <input
        id="producto-imagen"
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(evento) => {
          const archivo = evento.target.files?.[0];
          if (archivo) void manejarArchivo(archivo);
        }}
      />
      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => inputRef.current?.click()}
          disabled={esValidando || estado.fase === "subiendo"}
        >
          {imagenActual ? "Cambiar la foto" : "Elegir una foto"}
        </Button>
        {estado.fase === "subiendo" && (
          <p className="text-ink-muted mt-2 text-sm" aria-live="polite">
            Subiendo la foto…
          </p>
        )}
      </div>
      {estado.fase === "error" && (
        <p
          role="alert"
          className="rounded-control border-clay/35 bg-clay/10 text-clay-deep px-3 py-2 text-sm"
        >
          {estado.mensaje}
        </p>
      )}
      {/* La previsualización es la URL definitiva de Cloudinary, no un
          `URL.createObjectURL`: el blob muere con la pestaña y el usuario
          la vería distinta a como va a quedar publicada. */}
      {estado.fase === "lista" && (
        <div className="flex items-start gap-3">
          <Image
            src={estado.imageUrl}
            alt="Vista previa del producto"
            width={128}
            height={128}
            className="rounded-control border-line size-32 border object-cover"
          />
          <p className="text-ink-muted text-xs">
            La URL de arriba es la que queda guardada: si la cambiás a mano, la imagen vieja no se
            va a poder borrar.
          </p>
        </div>
      )}
    </div>
  );
};
