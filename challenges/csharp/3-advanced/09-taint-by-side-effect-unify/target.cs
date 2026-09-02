// Source: https://github.com/sshnet/SSH.NET/blob/c66b9f8fb06c12e71761e58a577b1e796026310f/src/Renci.SshNet/ScpClient.cs  (lines 827-853)
// Copyright (c) Renci, Oleg Kapeljushnik, Gert Driesen and contributors. Licensed under MIT. See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: yes — only the InternalDownload(IChannel, Stream, Stream, string, long) method kept; class declaration shortened (base class dropped); everything else replaced by `// ... (omitted)`; annotation comment added.
using System;
using System.IO;
using Renci.SshNet.Channels;

namespace Renci.SshNet
{
    public partial class ScpClient
    {
        // ... (omitted)

        private void InternalDownload(IChannel channel, Stream input, Stream output, string filename, long length)
        {
            var buffer = new byte[Math.Min(length, BufferSize)];
            var needToRead = length;

            do
            {
                var read = input.Read(buffer, 0, (int)Math.Min(needToRead, BufferSize));

                // ruleid: scp-buffer-passthrough
                output.Write(buffer, 0, read);

                RaiseDownloadingEvent(filename, length, length - needToRead);

                needToRead -= read;
            }
            while (needToRead > 0);

            output.Flush();

            // Raise one more time when file downloaded
            RaiseDownloadingEvent(filename, length, length - needToRead);

            // Send confirmation byte after last data byte was read
            SendSuccessConfirmation(channel);

            CheckReturnCode(input);
        }

        // ... (omitted)
    }
}
