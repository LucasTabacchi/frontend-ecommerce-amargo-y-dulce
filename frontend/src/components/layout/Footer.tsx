import Link from "next/link";
import { Facebook, Instagram, Phone, Mail } from "lucide-react";

/**
 * Footer del ecommerce:
 * - Centro: navegación extra (ayuda / legal)
 * - Derecha: contacto + redes
 */
export function Footer() {
  return (
    <footer className="bg-red-600 text-white">
      <div className="w-full px-6 py-12 lg:px-12">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          {/* =========================
              IZQUIERDA — MARCA
          ========================== */}
          <div>
            <div className="text-4xl font-extrabold leading-none">
              Amargo <br /> y Dulce
            </div>

            <p className="mt-4 max-w-sm text-sm text-red-100">
              Sabores para elegir, recuerdos para guardar. Chocolates pensados
              para regalar (o regalarte).
            </p>
          </div>

          {/* =========================
              CENTRO — LINKS / INFO
          ========================== */}
          <div className="grid grid-cols-2 gap-10 sm:gap-12">
            {/* Ayuda */}
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wide">
                Ayuda
              </h4>
              <ul className="mt-4 space-y-2 text-sm text-red-100">
                <li>
                  <Link className="hover:text-white" href="/envios">
                    Envíos
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-white" href="/preguntas-frecuentes">
                    Preguntas frecuentes
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-white" href="/sobre-nosotros">
                    Sobre nosotros
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-white" href="/promociones">
                    Promociones
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wide">
                Legal
              </h4>
              <ul className="mt-4 space-y-2 text-sm text-red-100">
                <li>
                  <Link
                    className="hover:text-white"
                    href="/terminos-y-condiciones"
                  >
                    Términos y condiciones
                  </Link>
                </li>
                <li>
                  <Link
                    className="hover:text-white"
                    href="/politica-de-privacidad"
                  >
                    Política de privacidad
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-white" href="/libro-de-quejas">
                    Libro de Quejas Online
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* =========================
              DERECHA — CONTACTO / REDES
          ========================== */}
          <div className="lg:text-right">
            <h4 className="text-sm font-bold uppercase tracking-wide">
              Contactos
            </h4>

            <div className="mt-4 space-y-3 text-sm text-red-100">
              <div className="flex items-start gap-3 lg:justify-end">
                <Mail className="h-5 w-5 flex-shrink-0 text-white" />
                <span>contacto@amargoydulce.com</span>
              </div>

              <div className="flex items-center gap-3 lg:justify-end">
                <Phone className="h-5 w-5 text-white" />
                <span>+54 9 11 3558-2177</span>
              </div>

              <div className="flex items-center gap-3 lg:justify-end">
                <Facebook className="h-5 w-5 text-white" />
                <span>Amargo y Dulce</span>
              </div>

              <div className="flex items-center gap-3 lg:justify-end">
                <Instagram className="h-5 w-5 text-white" />
                <span>@AmargoDulce</span>
              </div>
            </div>
          </div>
        </div>

        {/* Línea inferior */}
        <div className="mt-10 border-t border-white/20 pt-6 text-xs text-red-100">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              © {new Date().getFullYear()} Amargo y Dulce. Todos los derechos
              reservados.
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
