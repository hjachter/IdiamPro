export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: March 22, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-3">Overview</h2>
            <p>
              IdiamPro is a professional outlining application. We are committed to protecting your privacy.
              Your outlines and documents are stored locally on your device and are never uploaded to our servers
              for storage. This policy explains what data is processed when you use AI-powered features.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Data Storage</h2>
            <p>
              All your outlines, documents, and settings are stored locally on your device. IdiamPro does not
              maintain user accounts, cloud storage, or any server-side database of your content. When you use
              the desktop app, outlines are saved as <code>.idm</code> files in your chosen folder. On iOS,
              data is stored within the app&apos;s sandboxed storage.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Third-Party AI Services</h2>
            <p className="mb-4">
              When you use AI-powered features, your content is sent to third-party AI services for processing.
              This only occurs when you explicitly invoke an AI feature. No data is sent in the background or
              without your action.
            </p>

            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-1">Google Gemini (Google DeepMind)</h3>
                <p className="text-muted-foreground mb-2">
                  Used for: AI text generation, content expansion, outline creation, source extraction, help chat
                </p>
                <p><strong>Data sent:</strong> Your outline text, node names, and prompts related to the specific AI operation you initiated.</p>
                <p><strong>Data retained:</strong> Google processes the data to generate a response. Refer to Google&apos;s AI terms of service for their data retention practices.</p>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-1">OpenAI</h3>
                <p className="text-muted-foreground mb-2">
                  Used for: Podcast audio synthesis (text-to-speech)
                </p>
                <p><strong>Data sent:</strong> Generated podcast script text for voice synthesis.</p>
                <p><strong>Data retained:</strong> OpenAI processes audio generation requests per their API terms. No outline content is sent to OpenAI.</p>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-1">AssemblyAI</h3>
                <p className="text-muted-foreground mb-2">
                  Used for: Audio transcription with speaker detection
                </p>
                <p><strong>Data sent:</strong> Audio recordings you choose to transcribe.</p>
                <p><strong>Data retained:</strong> AssemblyAI processes recordings per their API terms. Recordings are not stored permanently.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">What We Do Not Collect</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>We do not collect personal information or create user profiles</li>
              <li>We do not track your usage or behavior within the app</li>
              <li>We do not store your outlines on any server</li>
              <li>We do not sell, share, or monetize your data</li>
              <li>We do not use your content to train AI models</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Microphone Access</h2>
            <p>
              IdiamPro requests microphone access only when you use the audio recording feature for
              transcription. Audio is recorded locally and sent to AssemblyAI only when you explicitly
              choose to transcribe it. Microphone access can be revoked at any time through your device settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Consent and Control</h2>
            <p>
              Before using any AI feature for the first time, IdiamPro displays a consent dialog explaining
              which services will process your data. You can decline and continue using all non-AI features.
              Consent can be revoked at any time in Settings, which will disable AI features until consent
              is granted again.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Children&apos;s Privacy</h2>
            <p>
              IdiamPro is not directed at children under 13. We do not knowingly collect personal
              information from children.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Changes to This Policy</h2>
            <p>
              We may update this privacy policy from time to time. Changes will be reflected in the
              &quot;Last updated&quot; date above. Continued use of AI features after changes constitutes
              acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Contact</h2>
            <p>
              If you have questions about this privacy policy, please contact us through our website.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t text-center">
          <a href="/app" className="text-sm text-blue-500 hover:underline">Back to IdiamPro</a>
        </div>
      </div>
    </div>
  );
}
