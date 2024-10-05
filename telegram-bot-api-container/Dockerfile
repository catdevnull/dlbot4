FROM debian:bookworm-slim

RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y make git zlib1g-dev libssl-dev gperf cmake clang libc++-dev libc++abi-dev && \
    git clone --recursive https://github.com/tdlib/telegram-bot-api.git && \
    cd telegram-bot-api && \
    rm -rf build && \
    mkdir build && \
    cd build && \
    CXXFLAGS="-stdlib=libc++" CC=/usr/bin/clang CXX=/usr/bin/clang++ cmake -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX:PATH=/usr/local .. && \
    cmake --build . --target install && \
    cd ../.. && \
    ls -l /usr/local/bin/telegram-bot-api* && \
    apt-get remove -y make git cmake clang && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* /telegram-bot-api

# required for runtime
# ENV TELEGRAM_API_ID
# ENV TELEGRAM_API_HASH

EXPOSE 8081

CMD ["/usr/local/bin/telegram-bot-api", "--local"]
