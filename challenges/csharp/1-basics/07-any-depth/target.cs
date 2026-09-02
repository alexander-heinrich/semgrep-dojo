// Source: https://github.com/microsoft/PowerToys/blob/911e614e1cfb4ac5bec333fa1073a63bbeec4a99/src/modules/MouseWithoutBorders/App/Core/Clipboard.cs  (lines 498-560)
// Copyright (c) Microsoft Corporation. Licensed under MIT. See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: yes — file-scoped namespace turned into a block; the rest of the method body after the local functions is omitted; annotation comments added.
using System;
using System.IO;
using System.Net.Sockets;

namespace MouseWithoutBorders.Core
{
    internal static class Clipboard
    {
        // ... (omitted)

        private static void ReceiveAndProcessClipboardDataCore(string remoteMachine, Socket s, Stream enStream, Stream deStream, string postAct)
        {
            ReceivedDestinationFile destinationFile = null;
            Stream m = null;

            void CloseDestinationFile()
            {
                destinationFile?.Dispose();
                destinationFile = null;
                m?.Close();
                m = null;
            }

            void DeleteDestinationFile(string path)
            {
                try
                {
                    bool success;
                    if (Common.RunOnLogonDesktop || Common.RunOnScrSaverDesktop)
                    {
                        // ruleid: file-delete
                        File.Delete(path);
                        success = true;
                    }
                    else
                    {
                        // ruleid: file-delete
                        success = Launch.ImpersonateLoggedOnUserAndDoSomething(() => File.Delete(path));
                    }

                    if (!success)
                    {
                        Logger.Log($"Could not delete incomplete destination file: {path}");
                    }
                }
                catch (Exception e)
                {
                    Logger.Log(e);
                }
            }

            void CommitDestinationFile(string sourcePath, string destinationPath)
            {
                bool success;
                if (Common.RunOnLogonDesktop || Common.RunOnScrSaverDesktop)
                {
                    // ok: file-delete
                    File.Move(sourcePath, destinationPath, overwrite: true);
                    success = true;
                }
                else
                {
                    // ok: file-delete
                    success = Launch.ImpersonateLoggedOnUserAndDoSomething(() => File.Move(sourcePath, destinationPath, overwrite: true));
                }

                if (!success)
                {
                    throw new IOException($"Could not replace destination file: {destinationPath}");
                }
            }

            void CreateDestinationFile(string path)
            {
                destinationFile = new ReceivedDestinationFile(path, DeleteDestinationFile, CommitDestinationFile);
                m = destinationFile.Stream;
            }

            // ... (omitted)
        }
    }
}
