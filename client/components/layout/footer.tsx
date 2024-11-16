/* ------------------ Imports ----------------- */
import { Twitter, Github } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

/* ----------------- Component ---------------- */
export function Footer() {
  return (
    <footer className="bg-[#070707] text-[#fcfff7] py-10">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Social Links */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Follow Us</h3>
            <div className="flex space-x-4">
              <a
                href="https://github.com/RedRoot-RDX"
                target="_blank"
                className="hover:text-[#fb3640] transition-colors"
                aria-label="GitHub"
              >
                <Github className="w-6 h-6" />
              </a>
              <a
                href="https://x.com/RedRoot_RDX"
                target="_blank"
                className="hover:text-[#fb3640] transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="w-6 h-6" />
              </a>
            </div>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Resources</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/docs" className="hover:text-[#fb3640] transition-colors">
                  Documentation
                </Link>
              </li>
              <li>
                <a 
                  href="https://buyxrd.com/" 
                  target="_blank" 
                  className="hover:text-[#fb3640] transition-colors"
                >
                  Buy XRD
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/privacy" className="hover:text-accent transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-accent transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          {/* Copyright */}
          <div className="space-y-4">
            <p className="text-sm text-muted-background">
              © {new Date().getFullYear()} Lattic3.
              <br />
              All wrights reverted.
            </p>
            <a
              href="https://www.radixdlt.com/"
              target="_blank"
              className="inline-block"
            >
              <Image
                src="/runs-on-radix.png"
                alt="Powered by Radix"
                width={120}
                height={40}
                className="opacity-80 hover:opacity-100 transition-opacity"
              />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
