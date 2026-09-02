// Source: https://github.com/dotnet/MQTTnet/blob/18731d9f02345a0fcec899ebfbd4bff7c05a57ce/Source/MQTTnet.TestApp/ServerTest.cs  (lines 5-196)
// Copyright (c) .NET Foundation and Contributors. Licensed under MIT. See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: yes — file-scoped namespace turned into a block; comments, a local constant and the event handlers in RunAsync omitted; one call split over two lines; annotation comments added.
using System.Text;
using MQTTnet.Diagnostics.Logger;
using MQTTnet.Internal;
using MQTTnet.Protocol;
using MQTTnet.Server;
using Newtonsoft.Json;

namespace MQTTnet.TestApp
{
    public static class ServerTest
    {
        public static void RunEmptyServer()
        {
            var mqttServer = new MqttServerFactory().CreateMqttServer(new MqttServerOptions());
            mqttServer.StartAsync().GetAwaiter().GetResult();

            // ruleid: press-any-key
            Console.WriteLine("Press any key to exit.");
            Console.ReadLine();
        }

        public static void RunEmptyServerWithLogging()
        {
            var logger = new MqttNetEventLogger();
            MqttNetConsoleLogger.ForwardToConsole(logger);

            var mqttServerFactory = new MqttServerFactory(logger);
            var mqttServer = mqttServerFactory.CreateMqttServer(new MqttServerOptions());
            mqttServer.StartAsync().GetAwaiter().GetResult();

            // ruleid: press-any-key
            Console.WriteLine(
                "Press any key to exit.");
            Console.ReadLine();
        }

        public static async Task RunAsync()
        {
            try
            {
                var options = new MqttServerOptionsBuilder()
                    .WithDefaultEndpoint()
                    .Build();

                var mqttServer = new MqttServerFactory().CreateMqttServer(options);

                // ... (omitted)

                mqttServer.ClientConnectedAsync += _ =>
                {
                    // ok: press-any-key
                    Console.Write("Client disconnected event fired.");
                    return CompletedTask.Instance;
                };

                await mqttServer.StartAsync();

                // ruleid: press-any-key
                Console.WriteLine("Press any key to exit.");
                Console.ReadLine();

                await mqttServer.StopAsync();
            }
            catch (Exception e)
            {
                // ok: press-any-key
                Console.WriteLine(e);
            }

            Console.ReadLine();
        }
    }
}
