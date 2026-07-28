import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import SEO from "@/components/SEO";

export default function CookiePolicy() {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Cookie Policy"
        description="Cookie policy for Mobile Tyre Vans — how we use cookies and similar technologies on our website."
        canonical="/cookie-policy"
        noindex={true}
      />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button variant="ghost" asChild className="mb-6" data-testid="button-back-home">
          <Link href="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </Button>

        <Card data-testid="card-cookie-policy">
          <CardHeader>
            <CardTitle className="text-4xl">Cookie Policy</CardTitle>
            <p className="text-muted-foreground">Last updated: November 2025</p>
          </CardHeader>
          <CardContent className="space-y-6 prose prose-invert max-w-none">
            <section>
              <h2 className="text-2xl font-semibold mb-3" data-testid="text-section-introduction">1. What Are Cookies</h2>
              <p>
                Cookies are small text files that are placed on your device when you visit our website. They help us provide you with a better experience by remembering your preferences and understanding how you use our site.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-2xl font-semibold mb-3" data-testid="text-section-types">2. Types of Cookies We Use</h2>

              <div className="space-y-4">
                <div>
                  <p className="font-semibold text-lg">Essential Cookies</p>
                  <p className="text-sm text-muted-foreground mb-2">Required for the website to function properly.</p>
                  <div className="bg-muted p-4 rounded-lg">
                    <p><strong>Purpose:</strong> Enable core functionality such as security, network management, and accessibility</p>
                    <p><strong>Duration:</strong> Session or up to 1 year</p>
                    <p><strong>Can be disabled:</strong> No — these are necessary for the site to work</p>
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-lg">Functional Cookies</p>
                  <p className="text-sm text-muted-foreground mb-2">Remember your preferences and settings.</p>
                  <div className="bg-muted p-4 rounded-lg">
                    <p><strong>Purpose:</strong> Remember choices like language, region, or theme preferences</p>
                    <p><strong>Examples:</strong> Cookie consent preferences, configurator saved progress</p>
                    <p><strong>Duration:</strong> Up to 1 year</p>
                    <p><strong>Can be disabled:</strong> Yes, but may affect functionality</p>
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-lg">Analytics Cookies</p>
                  <p className="text-sm text-muted-foreground mb-2">Help us understand how visitors use our site.</p>
                  <div className="bg-muted p-4 rounded-lg">
                    <p><strong>Purpose:</strong> Collect anonymous information about visitor behaviour to improve our website</p>
                    <p><strong>Examples:</strong> Pages visited, time spent on site, navigation patterns</p>
                    <p><strong>Duration:</strong> Up to 2 years</p>
                    <p><strong>Can be disabled:</strong> Yes</p>
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-lg">Marketing Cookies</p>
                  <p className="text-sm text-muted-foreground mb-2">Track your activity to deliver relevant advertising.</p>
                  <div className="bg-muted p-4 rounded-lg">
                    <p><strong>Purpose:</strong> Build a profile of your interests and show relevant ads</p>
                    <p><strong>Examples:</strong> Advertising network cookies, remarketing pixels</p>
                    <p><strong>Duration:</strong> Up to 2 years</p>
                    <p><strong>Can be disabled:</strong> Yes</p>
                  </div>
                </div>
              </div>
            </section>

            <Separator />

            <section>
              <h2 className="text-2xl font-semibold mb-3" data-testid="text-section-specific">3. Specific Cookies Used</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Cookie Name</th>
                      <th className="text-left p-2">Purpose</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-2 font-mono text-sm">cookie_consent</td>
                      <td className="p-2">Stores your cookie preferences</td>
                      <td className="p-2">Essential</td>
                      <td className="p-2">1 year</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 font-mono text-sm">session_id</td>
                      <td className="p-2">Maintains your session state</td>
                      <td className="p-2">Essential</td>
                      <td className="p-2">Session</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 font-mono text-sm">configurator_state</td>
                      <td className="p-2">Saves your configurator progress</td>
                      <td className="p-2">Functional</td>
                      <td className="p-2">7 days</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 font-mono text-sm">_ga, _gid</td>
                      <td className="p-2">Google Analytics tracking</td>
                      <td className="p-2">Analytics</td>
                      <td className="p-2">2 years / 24 hours</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <Separator />

            <section>
              <h2 className="text-2xl font-semibold mb-3" data-testid="text-section-manage">4. How to Manage Cookies</h2>
              <p className="font-semibold">Cookie Consent Banner</p>
              <p>
                When you first visit our site, you'll see a cookie consent banner where you can choose which types of cookies to accept. You can change your preferences at any time using the cookie settings link in the footer.
              </p>

              <p className="font-semibold mt-4">Browser Settings</p>
              <p>
                You can also control cookies through your browser settings. Most browsers allow you to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>View and delete cookies</li>
                <li>Block third-party cookies</li>
                <li>Block cookies from specific sites</li>
                <li>Block all cookies</li>
                <li>Delete all cookies when you close your browser</li>
              </ul>

              <p className="mt-3">
                Please note that deleting or blocking cookies may impact your experience on our website and some features may not work properly.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-2xl font-semibold mb-3" data-testid="text-section-third-party">5. Third-Party Cookies</h2>
              <p>
                Some cookies are placed by third-party services that appear on our pages. We do not control these cookies. Please check the third-party websites for more information:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Google Analytics: <a href="https://policies.google.com/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a></li>
              </ul>
            </section>

            <Separator />

            <section>
              <h2 className="text-2xl font-semibold mb-3" data-testid="text-section-updates">6. Updates to This Policy</h2>
              <p>
                We may update this Cookie Policy from time to time to reflect changes in our practices or for legal reasons. We will notify you of any significant changes by posting a notice on our website.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-2xl font-semibold mb-3" data-testid="text-section-more">7. More Information</h2>
              <p>
                For more information about how we handle your personal data, please read our <Link href="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link>.
              </p>
              <p className="mt-3">If you have questions about our use of cookies, please contact us:</p>
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
