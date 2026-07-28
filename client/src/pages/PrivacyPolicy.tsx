import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import SEO from "@/components/SEO";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Privacy Policy"
        description="Privacy policy for Mobile Tyre Vans — how we collect, use, and protect your personal data in compliance with UK GDPR."
        canonical="/privacy-policy"
        noindex={true}
      />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button variant="ghost" asChild className="mb-6" data-testid="button-back-home">
          <Link href="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </Button>

        <Card data-testid="card-privacy-policy">
          <CardHeader>
            <CardTitle className="text-4xl">Privacy Policy</CardTitle>
            <p className="text-muted-foreground">Last updated: November 2025</p>
          </CardHeader>
          <CardContent className="space-y-6 prose prose-invert max-w-none">
            <section>
              <h2 className="text-2xl font-semibold mb-3" data-testid="text-section-introduction">1. Introduction</h2>
              <p>
                Mobile Tyre Vans ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or use our services.
              </p>
              <p className="mt-3">
                For the purposes of UK data protection law (UK GDPR and the Data Protection Act 2018), Mobile Tyre Vans is the data controller of personal information collected through this website and through our services.
              </p>
              <p className="mt-3">
                The website platform itself is owned by GAJO Creative Ltd (Company No. 16669280). GAJO Creative Ltd does not control or process the personal data collected through this website in the ordinary course of its operation. See our <Link href="/terms" className="text-primary hover:underline">Terms and Conditions, Section 12</Link>, for further detail on platform ownership.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-2xl font-semibold mb-3" data-testid="text-section-information">2. Information We Collect</h2>
              <p className="font-semibold">Personal Information</p>
              <p>We may collect personal information that you voluntarily provide to us when you:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Request a quote or configure a van conversion</li>
                <li>Contact us via email or phone</li>
                <li>Subscribe to our newsletter</li>
                <li>Fill out a contact form</li>
              </ul>
              <p className="mt-3">This information may include:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Name and contact details (email, phone number)</li>
                <li>Company information</li>
                <li>Vehicle information and preferences</li>
                <li>Finance application details (if applicable)</li>
              </ul>

              <p className="font-semibold mt-4">Automatically Collected Information</p>
              <p>When you visit our website, we may automatically collect certain information about your device, including:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>IP address and browser type</li>
                <li>Operating system</li>
                <li>Pages visited and time spent on pages</li>
                <li>Referring website addresses</li>
              </ul>
            </section>

            <Separator />

            <section>
              <h2 className="text-2xl font-semibold mb-3" data-testid="text-section-usage">3. How We Use Your Information</h2>
              <p>We use the information we collect to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Process and fulfil your quote requests and orders</li>
                <li>Communicate with you about our services</li>
                <li>Improve our website and services</li>
                <li>Send you marketing communications (with your consent)</li>
                <li>Comply with legal obligations</li>
                <li>Detect and prevent fraud or abuse</li>
              </ul>
            </section>

            <Separator />

            <section>
              <h2 className="text-2xl font-semibold mb-3" data-testid="text-section-sharing">4. Information Sharing and Disclosure</h2>
              <p>We do not sell your personal information. We may share your information with:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Service Providers:</strong> Third-party companies that help us operate our business (e.g., payment processors, email service providers, hosting providers)</li>
                <li><strong>Finance Partners:</strong> If you apply for finance, we may share relevant information with our finance partners</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect our rights and safety</li>
              </ul>
              <p className="mt-3">
                We do not share personal data with GAJO Creative Ltd as part of our normal business operations. GAJO Creative Ltd, as the platform owner, may have technical access to the platform infrastructure for the purposes of maintenance, security, and platform integrity, but does not process personal data for its own purposes.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-2xl font-semibold mb-3" data-testid="text-section-cookies">5. Cookies and Tracking</h2>
              <p>
                We use cookies and similar tracking technologies to improve your browsing experience. For detailed information about our cookie usage, please see our <Link href="/cookie-policy" className="text-primary hover:underline">Cookie Policy</Link>.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-2xl font-semibold mb-3" data-testid="text-section-security">6. Data Security</h2>
              <p>
                We implement appropriate technical and organisational measures to protect your personal information. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-2xl font-semibold mb-3" data-testid="text-section-rights">7. Your Rights</h2>
              <p>Under data protection law, you have rights including:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Access:</strong> Request a copy of your personal data</li>
                <li><strong>Correction:</strong> Request correction of inaccurate data</li>
                <li><strong>Deletion:</strong> Request deletion of your data</li>
                <li><strong>Restriction:</strong> Request restriction of processing</li>
                <li><strong>Portability:</strong> Request transfer of your data</li>
                <li><strong>Objection:</strong> Object to processing of your data</li>
                <li><strong>Withdraw Consent:</strong> Withdraw consent at any time</li>
              </ul>
              <p className="mt-3">To exercise these rights, please contact us using the details below.</p>
              <p className="mt-3">
                You also have the right to lodge a complaint with the Information Commissioner's Office (ICO) at{" "}
                <a href="https://ico.org.uk" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">ico.org.uk</a>.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-2xl font-semibold mb-3" data-testid="text-section-retention">8. Data Retention</h2>
              <p>
                We retain your personal information only for as long as necessary to fulfil the purposes outlined in this Privacy Policy, unless a longer retention period is required by law.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-2xl font-semibold mb-3" data-testid="text-section-changes">9. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-2xl font-semibold mb-3" data-testid="text-section-contact">10. Contact Us</h2>
              <p>For privacy-related enquiries and to exercise your data rights, please contact us:</p>
              <div className="bg-muted p-4 rounded-lg mt-3 mb-4">
                <p><strong>Email:</strong> <a href="mailto:privacy@mobiletyrevans.co.uk" className="text-primary hover:underline">privacy@mobiletyrevans.co.uk</a></p>
                <p><strong>Phone:</strong> 0800 000 0000</p>
                <p><strong>Address:</strong> Unit 1, Example Business Park, Your Town, AA1 1AA</p>
              </div>
              <p>For platform / Digital Asset licensing enquiries, please contact GAJO Creative Ltd:</p>
              <div className="bg-muted p-4 rounded-lg mt-3">
                <p><strong>Email:</strong> <a href="mailto:hello@gajocreative.co.uk" className="text-primary hover:underline">hello@gajocreative.co.uk</a></p>
              </div>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
